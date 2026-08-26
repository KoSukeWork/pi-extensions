import type { Api, Model } from "@earendil-works/pi-ai";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import {
	type BtwThinkingLevel,
	type CompleteSimpleFunction,
	completeSideThreadTurn,
	type SideQuestionAuth,
	type SideThread,
	type SideThreadTurn,
} from "./side-thread.js";
import type { TranscriptPagerAction } from "./transcript-pager.js";

export const BTW_WIDGET_KEY = "btw-side";
export const BTW_STATUS_KEY = "btw";
export const BTW_FOLLOWUP_TITLE =
	"btw: follow-up\nEmpty line closes. /bring sends the latest Q&A to the main editor.";

type RpcBtwModel = {
	model: Model<Api>;
	auth: SideQuestionAuth;
};

type ThreadSteering = {
	questions: readonly string[];
	submit: (question: string) => void;
	thinking: { level: BtwThinkingLevel };
};

export function publishBtwWidget(
	ctx: ExtensionCommandContext,
	thread: SideThread,
	status: "idle" | "answering",
	pendingQuestion?: string,
): void {
	ctx.ui.setStatus(BTW_STATUS_KEY, status === "answering" ? "btw answering" : "btw · side thread");
	ctx.ui.setWidget(BTW_WIDGET_KEY, formatBtwLines(thread, status, pendingQuestion));
}

export function clearBtwUi(ctx: ExtensionCommandContext): void {
	ctx.ui.setStatus(BTW_STATUS_KEY, undefined);
	ctx.ui.setWidget(BTW_WIDGET_KEY, undefined);
}

export async function rpcAskThreadQuestion(
	thread: SideThread,
	question: string,
	selected: RpcBtwModel,
	thinkingLevel: BtwThinkingLevel,
	ctx: ExtensionCommandContext,
	_steering: ThreadSteering,
): Promise<Awaited<ReturnType<typeof completeSideThreadTurn>>> {
	publishBtwWidget(ctx, thread, "answering", question);
	const result = await completeSideThreadTurn({
		thread,
		question,
		model: selected.model,
		thinkingLevel,
		auth: selected.auth,
		signal: ctx.signal,
		completeSimple: createCompleteSimple(ctx),
	});
	publishBtwWidget(ctx, thread, "idle");
	return result;
}

export async function rpcShowThreadComposer(
	thread: SideThread,
	_startAtBottom: boolean,
	ctx: ExtensionCommandContext,
	initialQuestion: string | undefined,
	_thinking: { level: BtwThinkingLevel },
): Promise<TranscriptPagerAction> {
	if (initialQuestion?.trim()) return { kind: "submit", question: initialQuestion.trim() };
	publishBtwWidget(ctx, thread, "idle");
	const value = await ctx.ui.input(BTW_FOLLOWUP_TITLE, "Side question");
	if (value == null) return { kind: "close" };
	const trimmed = value.trim();
	if (!trimmed) return { kind: "close" };
	if (trimmed === "/bring" || trimmed.startsWith("/bring ")) {
		return { kind: "bringToMain", questionDraft: "" };
	}
	return { kind: "submit", question: trimmed };
}

function createCompleteSimple(ctx: ExtensionCommandContext): CompleteSimpleFunction {
	return async (model, context, options) => {
		const provider = ctx.modelRegistry.getProvider(model.provider);
		if (!provider) throw new Error(`No provider registered for model provider: ${model.provider}`);
		return provider.streamSimple(model, context, options).result();
	};
}

function formatBtwLines(
	thread: SideThread,
	status: "idle" | "answering",
	pendingQuestion?: string,
): string[] {
	const lines = [`btw · ${status}`];
	for (const turn of thread.turns) pushTurn(lines, turn);
	if (pendingQuestion) {
		lines.push("", `You: ${pendingQuestion}`, "", status === "answering" ? "…" : "");
	}
	return lines;
}

function pushTurn(lines: string[], turn: SideThreadTurn): void {
	lines.push("", `You: ${turn.question}`, "", turn.answer);
}
