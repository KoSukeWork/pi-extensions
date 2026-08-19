var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// packages/pi-plan-mode/src/completion-tool.ts
import { getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { Markdown } from "@earendil-works/pi-tui";
function normalizePlanModeCompletion(input) {
  if (!isRecord(input) || typeof input.plan !== "string") {
    return { ok: false, error: "plan must be a string" };
  }
  const plan = input.plan.trim();
  if (!plan) return { ok: false, error: "plan must not be empty" };
  if (plan.length > PLAN_MODE_MAX_CHARS) {
    return {
      ok: false,
      error: `plan must not exceed ${PLAN_MODE_MAX_CHARS} characters`
    };
  }
  return { ok: true, plan };
}
function planFromCompletionDetails(value) {
  if (!isRecord(value)) return void 0;
  if (value.version !== PLAN_MODE_COMPLETE_VERSION || value.source !== PLAN_MODE_COMPLETE_TOOL_NAME) {
    return void 0;
  }
  const normalized = normalizePlanModeCompletion({ plan: value.plan });
  return normalized.ok ? normalized.plan : void 0;
}
function planModeCompleted(plan) {
  return {
    content: [{ type: "text", text: `**Proposed Plan**

${plan}` }],
    details: {
      version: PLAN_MODE_COMPLETE_VERSION,
      source: PLAN_MODE_COMPLETE_TOOL_NAME,
      plan
    },
    terminate: true
  };
}
function planModeCompletionMarkdown(result) {
  const content = result.content.filter((block) => block.type === "text" && typeof block.text === "string").map((block) => block.text).join("\n").trim();
  if (content) return content;
  const plan = planFromCompletionDetails(result.details);
  return plan ? `**Proposed Plan**

${plan}` : "";
}
function renderPlanModeCompletion(result) {
  return new Markdown(planModeCompletionMarkdown(result), 0, 0, getMarkdownTheme());
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
var PLAN_MODE_COMPLETE_TOOL_NAME, PLAN_MODE_COMPLETE_VERSION, PLAN_MODE_MAX_CHARS, PLAN_MODE_COMPLETE_PARAMS;
var init_completion_tool = __esm({
  "packages/pi-plan-mode/src/completion-tool.ts"() {
    "use strict";
    PLAN_MODE_COMPLETE_TOOL_NAME = "plan_mode_complete";
    PLAN_MODE_COMPLETE_VERSION = 1;
    PLAN_MODE_MAX_CHARS = 5e4;
    PLAN_MODE_COMPLETE_PARAMS = {
      type: "object",
      additionalProperties: false,
      required: ["plan"],
      properties: {
        plan: {
          type: "string",
          minLength: 1,
          maxLength: PLAN_MODE_MAX_CHARS,
          description: "The complete decision-ready implementation plan in Markdown."
        }
      }
    };
  }
});

// packages/pi-plan-mode/src/message-transform.ts
function parseProposedPlan(text) {
  const openingCount = text.match(/<proposed_plan>/gi)?.length ?? 0;
  const closingCount = text.match(/<\/proposed_plan>/gi)?.length ?? 0;
  if (openingCount === 0 && closingCount === 0) return { kind: "absent" };
  if (openingCount > 1 || closingCount > 1) return { kind: "multiple" };
  if (openingCount === 1 && closingCount === 0) return { kind: "unclosed" };
  if (openingCount !== 1 || closingCount !== 1) return { kind: "malformed" };
  const matches = Array.from(text.matchAll(PROPOSED_PLAN_PATTERN));
  if (matches.length !== 1) return { kind: "malformed" };
  const plan = matches[0]?.[1]?.trim() ?? "";
  return plan ? { kind: "valid", plan } : { kind: "empty" };
}
function invalidPlanMessage(kind) {
  const detail = {
    empty: "the block is empty",
    multiple: "more than one plan block was produced",
    malformed: "the tags must be on their own lines",
    unclosed: "the closing tag is missing"
  }[kind];
  return `Proposed plan is not ready: ${detail}. Continue Plan mode and produce one complete non-empty <proposed_plan> block.`;
}
function latestAssistantText(messages) {
  if (!Array.isArray(messages)) return "";
  for (const entry of [...messages].reverse()) {
    const message = entry?.message ?? entry;
    if (message?.role !== "assistant") continue;
    const text = messageText(message);
    if (text) return text;
  }
  return "";
}
function messageContainsLegacyPlanModeContextArtifact(message) {
  return unwrapSessionMessage(message).customType === PLAN_CONTEXT_MESSAGE_TYPE;
}
function messageContainsPlanModeImplementationContextArtifact(message) {
  return unwrapSessionMessage(message).customType === PLAN_IMPLEMENTATION_CONTEXT_MESSAGE_TYPE;
}
function injectActiveImplementationContext(messages, activeImplementation) {
  let foundCurrentHandoff = false;
  const messagesWithoutStaleContext = messages.filter((message) => {
    if (messageContainsPlanModeImplementationContextArtifact(message)) return false;
    if (!messageContainsPlanModeImplementationHandoff(message)) return true;
    if (!foundCurrentHandoff && messageContainsExactPlanModeImplementationHandoff(message, activeImplementation.plan)) {
      foundCurrentHandoff = true;
      return true;
    }
    return false;
  });
  if (foundCurrentHandoff) return messagesWithoutStaleContext;
  let insertionIndex = 0;
  while (isSummaryMessage(messagesWithoutStaleContext[insertionIndex])) insertionIndex += 1;
  const contextMessage = {
    role: "custom",
    customType: PLAN_IMPLEMENTATION_CONTEXT_MESSAGE_TYPE,
    content: `[ACTIVE IMPLEMENTATION PLAN]

The user approved the exact implementation plan below. Continue following it until the user explicitly clears or supersedes it. The exact plan is the remainder of this message:

${activeImplementation.plan}`,
    display: false,
    timestamp: activeImplementation.startedAt
  };
  return [
    ...messagesWithoutStaleContext.slice(0, insertionIndex),
    contextMessage,
    ...messagesWithoutStaleContext.slice(insertionIndex)
  ];
}
function messageContainsInactivePlanModeArtifact(message) {
  const candidate = unwrapSessionMessage(message);
  return candidate.customType === PROPOSED_PLAN_MESSAGE_TYPE || candidate.role === "toolResult" && candidate.toolName === PLAN_MODE_COMPLETE_TOOL_NAME;
}
function messageContainsPlanModeImplementationHandoff(message) {
  const candidate = unwrapSessionMessage(message);
  return candidate.role === "user" && contentText(candidate.content).trimStart().startsWith(PLAN_IMPLEMENTATION_HANDOFF_PREFIX);
}
function messageContainsExactPlanModeImplementationHandoff(message, plan) {
  const candidate = unwrapSessionMessage(message);
  if (candidate.role !== "user") return false;
  return contentText(candidate.content).trim() === `${PLAN_IMPLEMENTATION_HANDOFF_PREFIX}

${plan}`.trim();
}
function isSummaryMessage(message) {
  const role = unwrapSessionMessage(message)?.role;
  return role === "compactionSummary" || role === "branchSummary";
}
function stripProposedPlanBlocksFromMessage(message) {
  return replaceAssistantContent(message, stripProposedPlanBlocksFromContent);
}
function stripPlanModeCompletionCallsFromMessage(message) {
  return replaceAssistantContent(message, (content) => {
    if (!Array.isArray(content)) return content;
    const nextContent = content.filter((block) => {
      const candidate = block;
      return !(candidate.type === "toolCall" && candidate.name === PLAN_MODE_COMPLETE_TOOL_NAME);
    });
    return nextContent.length === content.length ? content : nextContent;
  });
}
function isEmptyAssistantMessage(message) {
  const candidate = unwrapSessionMessage(message);
  return candidate.role === "assistant" && Array.isArray(candidate.content) && candidate.content.length === 0;
}
function replaceAssistantContent(message, transform) {
  const candidate = unwrapSessionMessage(message);
  if (candidate.role !== "assistant") return message;
  const content = transform(candidate.content);
  if (content === candidate.content) return message;
  if (isSessionMessageEntry(message)) {
    return { ...message, message: { ...candidate, content } };
  }
  return { ...candidate, content };
}
function unwrapSessionMessage(message) {
  const entry = message;
  return entry?.message ?? message ?? {};
}
function isSessionMessageEntry(message) {
  return typeof message === "object" && message !== null && "message" in message;
}
function stripProposedPlanBlocksFromContent(content) {
  if (typeof content === "string") return stripProposedPlanBlocks(content);
  if (!Array.isArray(content)) return content;
  let changed = false;
  const nextContent = content.map((block) => {
    const textBlock = block;
    if (textBlock.type !== "text" || typeof textBlock.text !== "string") return block;
    const text = stripProposedPlanBlocks(textBlock.text);
    if (text === textBlock.text) return block;
    changed = true;
    return { ...textBlock, text };
  });
  return changed ? nextContent : content;
}
function stripProposedPlanBlocks(text) {
  return text.replace(PROPOSED_PLAN_BLOCK_PATTERN, "");
}
function messageText(message) {
  return contentText(message.content);
}
function contentText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((block) => {
    const textBlock = block;
    return textBlock.type === "text" && typeof textBlock.text === "string" ? textBlock.text : "";
  }).filter(Boolean).join("\n");
}
var PLAN_CONTEXT_MESSAGE_TYPE, PLAN_IMPLEMENTATION_CONTEXT_MESSAGE_TYPE, PROPOSED_PLAN_MESSAGE_TYPE, PLAN_IMPLEMENTATION_HANDOFF_PREFIX, PROPOSED_PLAN_PATTERN, PROPOSED_PLAN_BLOCK_PATTERN;
var init_message_transform = __esm({
  "packages/pi-plan-mode/src/message-transform.ts"() {
    "use strict";
    init_completion_tool();
    PLAN_CONTEXT_MESSAGE_TYPE = "plan-mode-context";
    PLAN_IMPLEMENTATION_CONTEXT_MESSAGE_TYPE = "plan-mode-implementation-context";
    PROPOSED_PLAN_MESSAGE_TYPE = "proposed-plan";
    PLAN_IMPLEMENTATION_HANDOFF_PREFIX = "Plan mode is now disabled. Full tool access is restored. Implement this proposed plan now:";
    PROPOSED_PLAN_PATTERN = /^<proposed_plan>[\t ]*\r?\n([\s\S]*?)\r?\n<\/proposed_plan>[\t ]*$/gm;
    PROPOSED_PLAN_BLOCK_PATTERN = /^<proposed_plan>[\t ]*\r?\n[\s\S]*?\r?\n<\/proposed_plan>[\t ]*$/gm;
  }
});

// packages/pi-plan-mode/src/implementation-retention.ts
function retentionLabel(retention) {
  return {
    keep: "Keep plan active",
    "clear-on-start": "Use plan for handoff only",
    "clear-after-first-run": "Clear after first implementation run"
  }[retention];
}
function implementationRetentionPreview(retention) {
  return {
    keep: "After Implement: Keep plan active until /plan exit.",
    "clear-on-start": "After Implement: Use the plan for the implementation handoff only, then clear it.",
    "clear-after-first-run": "After Implement: Clear after the first implementation run settles."
  }[retention];
}
function createImplementationRetentionCoordinator() {
  let implementationWithDeliveredContext;
  let restoredImplementationAwaitingContext;
  return {
    restore(activeImplementation) {
      restoredImplementationAwaitingContext = activeImplementation && activeImplementation.retention !== "keep" ? activeImplementation.id : void 0;
    },
    transformContext(messages, state) {
      const messagesWithoutPlanContext = messages.filter(
        (message) => !messageContainsLegacyPlanModeContextArtifact(message) && !messageContainsPlanModeImplementationContextArtifact(message)
      );
      if (state.enabled) {
        return {
          messages: messagesWithoutPlanContext.filter(
            (message) => !messageContainsPlanModeImplementationHandoff(message)
          )
        };
      }
      const activeImplementation = state.activeImplementation;
      const inactiveMessages = activeImplementation ? messagesWithoutPlanContext : messagesWithoutPlanContext.filter(
        (message) => !messageContainsPlanModeImplementationHandoff(message)
      );
      const filteredMessages = inactiveMessages.filter((message) => !messageContainsInactivePlanModeArtifact(message)).map(stripProposedPlanBlocksFromMessage).map(stripPlanModeCompletionCallsFromMessage).filter((message) => !isEmptyAssistantMessage(message));
      if (!activeImplementation) return { messages: filteredMessages };
      const contextualMessages = injectActiveImplementationContext(
        filteredMessages,
        activeImplementation
      );
      const deliveredCurrentHandoff = restoredImplementationAwaitingContext === activeImplementation.id || filteredMessages.some(
        (message) => messageContainsExactPlanModeImplementationHandoff(message, activeImplementation.plan)
      );
      if (!deliveredCurrentHandoff) return { messages: contextualMessages };
      restoredImplementationAwaitingContext = void 0;
      if (activeImplementation.retention === "clear-after-first-run") {
        implementationWithDeliveredContext = activeImplementation.id;
      }
      return {
        messages: contextualMessages,
        clearActiveImplementationId: activeImplementation.retention === "clear-on-start" ? activeImplementation.id : void 0
      };
    },
    implementationSettled(activeImplementation) {
      if (activeImplementation?.retention !== "clear-after-first-run" || implementationWithDeliveredContext !== activeImplementation.id) {
        return void 0;
      }
      implementationWithDeliveredContext = void 0;
      return activeImplementation.id;
    },
    reset() {
      implementationWithDeliveredContext = void 0;
      restoredImplementationAwaitingContext = void 0;
    }
  };
}
var init_implementation_retention = __esm({
  "packages/pi-plan-mode/src/implementation-retention.ts"() {
    "use strict";
    init_message_transform();
  }
});

// packages/pi-plan-mode/src/tool-policy.ts
function isBuiltinTool(tool) {
  return tool.sourceInfo.source === "builtin";
}
function classifyPlanModeTool(tool) {
  if (!isBuiltinTool(tool)) return "user-opt-in";
  if (BLOCKED_BUILTIN_TOOLS.has(tool.name)) return "blocked";
  if (tool.name === "bash") return "limited";
  return SAFE_BUILTIN_PLAN_TOOLS.has(tool.name) ? "read-only" : "blocked";
}
function canSelectToolInPlanMode(tool) {
  return classifyPlanModeTool(tool) !== "blocked";
}
function readCommand(input) {
  const command = input;
  return typeof command?.command === "string" ? command.command : "";
}
function findBlockedCommandSegment(command, safeSubcommands = {}) {
  const segments = splitShellSegments(command);
  if (!segments || segments.length === 0) return command.trim() || "(empty command)";
  return segments.find((segment) => !isSafeSegment(segment, safeSubcommands));
}
function splitShellSegments(command) {
  const trimmed = command.trim();
  if (!trimmed || /[\n\r`]/.test(trimmed)) return void 0;
  const segments = [];
  let quote;
  let escaped = false;
  let start = 0;
  for (let index = 0; index < trimmed.length; index += 1) {
    const character = trimmed[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = void 0;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === ">" || character === "<" || character === "(" || character === ")") {
      return void 0;
    }
    const next = trimmed[index + 1];
    if (character === "&" && next !== "&") return void 0;
    const separatorLength = character === ";" || character === "|" ? next === character ? 2 : 1 : character === "&" && next === "&" ? 2 : 0;
    if (separatorLength === 0) continue;
    const segment = trimmed.slice(start, index).trim();
    if (!segment) return void 0;
    segments.push(segment);
    index += separatorLength - 1;
    start = index + 1;
  }
  if (quote || escaped) return void 0;
  const finalSegment = trimmed.slice(start).trim();
  if (!finalSegment) return void 0;
  segments.push(finalSegment);
  return segments;
}
function isSafeSegment(segment, safeSubcommands) {
  if (hasShellExpansion(segment) || /(^|\s)[A-Za-z_][A-Za-z0-9_]*=/.test(segment)) {
    return false;
  }
  const tokens = shellWords(segment);
  if (!tokens || tokens.length === 0) return false;
  const command = tokens[0]?.toLowerCase();
  if (!command || MUTATING_COMMANDS.has(command)) return false;
  const args = tokens.slice(1);
  if (!hasSafeArguments(command, args)) return false;
  if (READ_ONLY_COMMANDS.has(command)) return true;
  return isSafeStructuredCommand(command, args, safeSubcommands);
}
function hasShellExpansion(segment) {
  let quote;
  let escaped = false;
  for (const character of segment) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = void 0;
      else if (character === "$" && quote === '"') return true;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (["$", "*", "?", "[", "{"].includes(character)) return true;
  }
  return false;
}
function shellWords(segment) {
  const words = [];
  let word = "";
  let quote;
  let escaped = false;
  for (const character of segment) {
    if (escaped) {
      word += character;
      escaped = false;
      continue;
    }
    if (character === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = void 0;
      else word += character;
      continue;
    }
    if (character === "'" || character === '"') quote = character;
    else if (/\s/.test(character)) {
      if (word) words.push(word);
      word = "";
    } else word += character;
  }
  if (quote || escaped) return void 0;
  if (word) words.push(word);
  return words;
}
function hasSafeArguments(command, args) {
  const forbidden = /* @__PURE__ */ new Set(["-i", "--in-place", "--fix", "--write", "-delete", "--delete"]);
  if (args.some((argument) => forbidden.has(argument))) return false;
  if (command === "sed" && args.some(
    (argument) => argument.startsWith("--in-place=") || /^-[^-]+/.test(argument) && argument.slice(1).includes("i")
  )) {
    return false;
  }
  if (command === "find" && args.some(
    (argument) => ["-exec", "-execdir", "-ok", "-okdir", "-fprint", "-fprint0", "-fprintf", "-fls"].includes(
      argument
    )
  )) {
    return false;
  }
  if (command === "date" && args.some((argument) => argument === "-s" || argument.startsWith("--set"))) {
    return false;
  }
  if ((command === "sort" || command === "tree") && args.some(
    (argument) => argument === "-o" || argument.startsWith("-o") && !argument.startsWith("--") || argument.startsWith("--output")
  )) {
    return false;
  }
  if (command === "sort" && args.some(
    (argument) => argument === "-T" || argument.startsWith("-T") && argument.length > 2 || argument.startsWith("--temporary-directory") || argument.startsWith("--compress-program")
  )) {
    return false;
  }
  if (command === "diff" && args.some((argument) => argument === "--output" || argument.startsWith("--output="))) {
    return false;
  }
  if (command === "uniq" && args.filter((argument) => !argument.startsWith("-")).length > 1) {
    return false;
  }
  if (command === "fd" && args.some(
    (argument) => ["-x", "-X", "--exec", "--exec-batch"].some(
      (flag) => argument === flag || argument.startsWith(`${flag}=`)
    )
  )) {
    return false;
  }
  if (command === "rg" && args.some((argument) => argument === "--pre" || argument.startsWith("--pre="))) {
    return false;
  }
  if (command === "bat" && args.some((argument) => argument === "--pager" || argument.startsWith("--pager="))) {
    return false;
  }
  return true;
}
function isSafeStructuredCommand(command, args, safeSubcommands) {
  if (command === "git") return isSafeGitCommand(args, safeSubcommands);
  if (command === "gh") return isSafeGhCommand(args, safeSubcommands);
  const subcommandIndex = args.findIndex((argument) => !argument.startsWith("-"));
  const subcommand = args[subcommandIndex]?.toLowerCase();
  const subcommandArgs = subcommandIndex >= 0 ? args.slice(subcommandIndex + 1) : [];
  if (command === "sed") {
    const script = args.find((argument) => !argument.startsWith("-"));
    return Boolean(script) && (args.includes("-n") || args.some((argument) => /^-[^-]*n[^-]*$/.test(argument))) && /^\d+(,\d+)?p$/.test(script ?? "");
  }
  if (["node", "python", "python3", "tsc", "biome", "ruff", "ty"].includes(command)) {
    if (args.includes("--version")) return true;
    return command === "tsc" && args.includes("--noEmit") && !args.some(
      (argument) => argument === "--incremental" || argument.startsWith("--incremental=") || argument === "--tsBuildInfoFile" || argument.startsWith("--tsBuildInfoFile=") || argument === "--generateTrace" || argument.startsWith("--generateTrace=")
    );
  }
  if (command === "npm") {
    if (subcommand === "audit" && subcommandArgs.includes("fix")) return false;
    if (["list", "ls", "view", "info", "search", "outdated", "audit", "test"].includes(
      subcommand ?? ""
    )) {
      return true;
    }
    return subcommand === "run" && ["test", "check", "typecheck", "lint"].includes(args[1] ?? "");
  }
  if (["cargo", "go", "pytest", "vitest", "jest"].includes(command)) {
    return ["test", "check"].includes(subcommand ?? "") || ["pytest", "vitest", "jest"].includes(command);
  }
  return false;
}
function isSafeGitCommand(args, safeSubcommands) {
  let subcommandIndex = 0;
  while (args[subcommandIndex] === "--no-pager") subcommandIndex += 1;
  const subcommand = args[subcommandIndex]?.toLowerCase();
  if (!subcommand || subcommand.startsWith("-")) return false;
  const subcommandArgs = args.slice(subcommandIndex + 1);
  const builtinValidator = BUILTIN_GIT_VALIDATORS[subcommand];
  const configuredValidator = CONFIGURABLE_GIT_VALIDATORS[subcommand];
  const configured = safeSubcommands.git?.includes(subcommand) === true;
  const validator = builtinValidator ?? (configured ? configuredValidator : void 0);
  return validator !== void 0 && hasSafeGitArguments(subcommand, subcommandArgs) && validator(subcommandArgs);
}
function hasSafeGitArguments(subcommand, args) {
  return !args.some(
    (argument) => argument === "--help" || argument === "--show-signature" || argument.startsWith("--show-signature=") || argument.includes("%G") || argument === "--output" || argument.startsWith("--output=") || argument === "--ext-diff" || argument.startsWith("--ext-diff=") || argument === "--textconv" || argument.startsWith("--textconv=") || argument === "--paginate" || argument === "--open-files-in-pager" || argument.startsWith("--open-files-in-pager=") || subcommand === "grep" && (argument === "-O" || argument.startsWith("-O"))
  );
}
function isSafeGitCatFileArguments(args) {
  return !args.some(
    (argument) => matchesLongOptionPrefix(argument, "--filters", "--fi") || matchesLongOptionPrefix(argument, "--textconv", "--t")
  );
}
function isSafeGitGrepArguments(args) {
  return !args.some(
    (argument) => matchesLongOptionPrefix(argument, "--textconv", "--textc") || matchesLongOptionPrefix(argument, "--open-files-in-pager", "--op") || matchesLongOptionPrefix(argument, "--ext-grep", "--ext")
  );
}
function matchesLongOptionPrefix(argument, option, shortest) {
  const optionName = argument.split("=", 1)[0] ?? "";
  return optionName.length >= shortest.length && option.startsWith(optionName);
}
function isSafeGitBranchArguments(args) {
  if (args.some((argument) => !argument.startsWith("-"))) return false;
  return !args.some(
    (argument) => /^-[^-]*[dDmMcCu]/.test(argument) || matchesLongOptionPrefix(argument, "--delete", "--del") || matchesLongOptionPrefix(argument, "--move", "--mov") || matchesLongOptionPrefix(argument, "--copy", "--cop") || matchesLongOptionPrefix(argument, "--edit-description", "--e") || matchesLongOptionPrefix(argument, "--unset-upstream", "--u") || matchesLongOptionPrefix(argument, "--set-upstream-to", "--set-u") || matchesLongOptionPrefix(argument, "--create-reflog", "--creat")
  );
}
function isSafeGitRemoteArguments(args) {
  const actionIndex = args.findIndex((argument) => !argument.startsWith("-"));
  if (actionIndex < 0) return true;
  const action = args[actionIndex];
  if (action === "get-url") return true;
  if (action !== "show") return false;
  const showArgs = args.slice(actionIndex + 1);
  if (showArgs.includes("--")) return false;
  const remotes = showArgs.filter((argument) => !argument.startsWith("-"));
  return remotes.length === 0 || remotes.length === 1 && showArgs.includes("-n");
}
function isSafeGhCommand(args, safeSubcommands) {
  const group = args[0]?.toLowerCase();
  const action = args[1]?.toLowerCase();
  if (!group || !action || group.startsWith("-") || action.startsWith("-")) return false;
  const path = `${group} ${action}`;
  if (!safeSubcommands.gh?.includes(path)) return false;
  const validator = GH_VALIDATORS[path];
  return validator?.(args.slice(2)) ?? false;
}
function isSafeGhReadArguments(args) {
  return !args.some(isUnsafeGhReadArgument) && hasGhJsonOutput(args);
}
function isUnsafeGhReadArgument(argument) {
  return argument.startsWith("-w") || argument === "--web" || argument.startsWith("--web=") || argument === "--browser" || argument.startsWith("--browser=") || argument === "--paginate" || argument === "--pager" || argument.startsWith("--pager=") || argument === "--output" || argument.startsWith("--output=");
}
function hasGhJsonOutput(args) {
  let hasJson = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--json") {
      const value = args[index + 1];
      if (!value || value.startsWith("-")) return false;
      hasJson = true;
      index += 1;
    } else if (argument.startsWith("--json=")) {
      if (argument === "--json=") return false;
      hasJson = true;
    }
  }
  return hasJson;
}
var BUILTIN_SAFE_GIT_SUBCOMMANDS, CONFIGURABLE_SAFE_GIT_SUBCOMMANDS, SAFE_GIT_SUBCOMMANDS, SAFE_GH_SUBCOMMAND_PATHS, SAFE_BUILTIN_PLAN_TOOLS, BLOCKED_BUILTIN_TOOLS, MUTATING_COMMANDS, READ_ONLY_COMMANDS, allowReadOnlyArguments, BUILTIN_GIT_VALIDATORS, CONFIGURABLE_GIT_VALIDATORS, GH_VALIDATORS;
var init_tool_policy = __esm({
  "packages/pi-plan-mode/src/tool-policy.ts"() {
    "use strict";
    BUILTIN_SAFE_GIT_SUBCOMMANDS = [
      "status",
      "log",
      "diff",
      "show",
      "branch",
      "remote",
      "ls-files",
      "grep"
    ];
    CONFIGURABLE_SAFE_GIT_SUBCOMMANDS = [
      "rev-parse",
      "blame",
      "describe",
      "merge-base",
      "ls-tree",
      "cat-file"
    ];
    SAFE_GIT_SUBCOMMANDS = [
      ...BUILTIN_SAFE_GIT_SUBCOMMANDS,
      ...CONFIGURABLE_SAFE_GIT_SUBCOMMANDS
    ];
    SAFE_GH_SUBCOMMAND_PATHS = ["pr view", "pr list", "issue view", "issue list"];
    SAFE_BUILTIN_PLAN_TOOLS = /* @__PURE__ */ new Set(["read", "bash", "grep", "find", "ls"]);
    BLOCKED_BUILTIN_TOOLS = /* @__PURE__ */ new Set(["edit", "write"]);
    MUTATING_COMMANDS = /* @__PURE__ */ new Set([
      "rm",
      "rmdir",
      "mv",
      "cp",
      "mkdir",
      "touch",
      "chmod",
      "chown",
      "chgrp",
      "ln",
      "tee",
      "truncate",
      "dd",
      "sudo",
      "su",
      "kill",
      "pkill",
      "killall",
      "reboot",
      "shutdown",
      "vim",
      "vi",
      "nano",
      "emacs",
      "code",
      "subl"
    ]);
    READ_ONLY_COMMANDS = /* @__PURE__ */ new Set([
      "cat",
      "head",
      "tail",
      "grep",
      "find",
      "ls",
      "pwd",
      "echo",
      "printf",
      "wc",
      "sort",
      "uniq",
      "diff",
      "file",
      "stat",
      "du",
      "df",
      "tree",
      "which",
      "whereis",
      "type",
      "printenv",
      "uname",
      "whoami",
      "id",
      "date",
      "uptime",
      "ps",
      "jq",
      "rg",
      "fd",
      "bat",
      "eza"
    ]);
    allowReadOnlyArguments = () => true;
    BUILTIN_GIT_VALIDATORS = {
      status: allowReadOnlyArguments,
      log: allowReadOnlyArguments,
      diff: allowReadOnlyArguments,
      show: allowReadOnlyArguments,
      branch: isSafeGitBranchArguments,
      remote: isSafeGitRemoteArguments,
      "ls-files": allowReadOnlyArguments,
      grep: isSafeGitGrepArguments
    };
    CONFIGURABLE_GIT_VALIDATORS = {
      "rev-parse": allowReadOnlyArguments,
      blame: allowReadOnlyArguments,
      describe: allowReadOnlyArguments,
      "merge-base": allowReadOnlyArguments,
      "ls-tree": allowReadOnlyArguments,
      "cat-file": isSafeGitCatFileArguments
    };
    GH_VALIDATORS = {
      "pr view": isSafeGhReadArguments,
      "pr list": isSafeGhReadArguments,
      "issue view": isSafeGhReadArguments,
      "issue list": isSafeGhReadArguments
    };
  }
});

// packages/pi-plan-mode/src/settings.ts
import { randomUUID as randomUUID2 } from "node:crypto";
import { constants } from "node:fs";
import { mkdir, open, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
function planModeSettingsPath() {
  return join(getAgentDir(), PLAN_MODE_SETTINGS_FILE);
}
function legacyPlanModeSettingsPath() {
  return join(getAgentDir(), LEGACY_PLAN_MODE_SETTINGS_FILE);
}
function normalizePlanModeSettings(value) {
  if (!isSettingsDocument(value)) return void 0;
  const thinkingLevel = Object.hasOwn(value, "thinkingLevel") ? Reflect.get(value, "thinkingLevel") : "inherit";
  if (!PLAN_MODE_THINKING_LEVELS.includes(thinkingLevel)) {
    return void 0;
  }
  const settings = {
    thinkingLevel
  };
  if (Object.hasOwn(value, "defaultPlanTools")) {
    const defaultPlanTools = normalizeToolNames(Reflect.get(value, "defaultPlanTools"));
    if (!defaultPlanTools) return void 0;
    settings.defaultPlanTools = defaultPlanTools;
  }
  if (Object.hasOwn(value, "implementationPlanRetention")) {
    const implementationPlanRetention = Reflect.get(value, "implementationPlanRetention");
    if (!IMPLEMENTATION_PLAN_RETENTIONS.includes(
      implementationPlanRetention
    )) {
      return void 0;
    }
    settings.implementationPlanRetention = implementationPlanRetention;
  }
  if (Object.hasOwn(value, "defaultPlanExportPath")) {
    const defaultPlanExportPath = normalizePlanExportPath(
      Reflect.get(value, "defaultPlanExportPath")
    );
    if (!defaultPlanExportPath) return void 0;
    settings.defaultPlanExportPath = defaultPlanExportPath;
  }
  if (Object.hasOwn(value, "safeSubcommands")) {
    const safeSubcommands = normalizeSafeSubcommands(Reflect.get(value, "safeSubcommands"));
    if (!safeSubcommands) return void 0;
    settings.safeSubcommands = safeSubcommands;
  }
  return settings;
}
function normalizeToolNames(value) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item.trim().length > 0)) {
    return void 0;
  }
  return Array.from(new Set(value));
}
function normalizePlanExportPath(value) {
  if (typeof value !== "string") return void 0;
  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_PLAN_EXPORT_PATH_LENGTH || !/[^@\s]/u.test(normalized) || [...normalized].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint >= 127 && codePoint <= 159;
  })) {
    return void 0;
  }
  return normalized;
}
function normalizeSafeSubcommands(value) {
  if (!isSettingsDocument(value)) return void 0;
  if (Object.keys(value).some((key) => key !== "git" && key !== "gh")) return void 0;
  const safeSubcommands = {};
  if (Object.hasOwn(value, "git")) {
    const git = normalizeKnownValues(Reflect.get(value, "git"), SAFE_GIT_SUBCOMMANDS);
    if (!git) return void 0;
    safeSubcommands.git = git;
  }
  if (Object.hasOwn(value, "gh")) {
    const gh = normalizeKnownValues(Reflect.get(value, "gh"), SAFE_GH_SUBCOMMAND_PATHS);
    if (!gh) return void 0;
    safeSubcommands.gh = gh;
  }
  return safeSubcommands;
}
function normalizeKnownValues(value, supported) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && supported.includes(item))) {
    return void 0;
  }
  return Array.from(new Set(value));
}
async function readPlanModeSettings(settingsPath) {
  if (settingsPath) {
    await awaitPlanModeSettingsWrites(settingsPath);
    return (await readSettingsSnapshot(settingsPath)).result;
  }
  const canonicalPath = planModeSettingsPath();
  await awaitPlanModeSettingsWrites(canonicalPath);
  const canonical = await readSettingsSnapshot(canonicalPath);
  const legacyPath = legacyPlanModeSettingsPath();
  if (canonical.result.kind !== "missing") {
    return await pathExists(legacyPath) ? {
      ...canonical.result,
      notice: `${LEGACY_PLAN_MODE_SETTINGS_FILE} ignored because ${PLAN_MODE_SETTINGS_FILE} takes precedence.`
    } : canonical.result;
  }
  const legacy = await readSettingsSnapshot(legacyPath);
  const raced = await readSettingsSnapshot(canonicalPath);
  if (raced.result.kind !== "missing") return raced.result;
  return legacy.result.kind === "loaded" ? {
    ...legacy.result,
    notice: `Using legacy ${LEGACY_PLAN_MODE_SETTINGS_FILE}; rename it to ${PLAN_MODE_SETTINGS_FILE}. The legacy file was not modified.`
  } : legacy.result;
}
function updatePlanModeSettings(patch, options = {}) {
  const settingsPath = options.settingsPath ?? planModeSettingsPath();
  const legacySettingsPath = options.legacySettingsPath ?? (options.settingsPath ? void 0 : legacyPlanModeSettingsPath());
  return enqueueMutation(settingsPath, async () => {
    options.signal?.throwIfAborted();
    const current = await readSettingsDocumentForUpdate(settingsPath, legacySettingsPath);
    const updated = { ...current };
    if (patch.thinkingLevel !== void 0) updated.thinkingLevel = patch.thinkingLevel;
    if (patch.defaultPlanTools === null) delete updated.defaultPlanTools;
    else if (patch.defaultPlanTools !== void 0) {
      updated.defaultPlanTools = [...patch.defaultPlanTools];
    }
    if (patch.implementationPlanRetention !== void 0) {
      updated.implementationPlanRetention = patch.implementationPlanRetention;
    }
    if (patch.defaultPlanExportPath === null) delete updated.defaultPlanExportPath;
    else if (patch.defaultPlanExportPath !== void 0) {
      updated.defaultPlanExportPath = patch.defaultPlanExportPath;
    }
    const settings = normalizePlanModeSettings(updated);
    if (!settings) throw invalidSettingsError(settingsPath, "invalid settings shape");
    await publishSettings(settingsPath, updated, options.signal, options.beforeRename);
    return settings;
  });
}
async function awaitPlanModeSettingsWrites(settingsPath = planModeSettingsPath()) {
  await mutationQueues.get(settingsPath);
}
function enqueueMutation(settingsPath, mutation) {
  const previous = mutationQueues.get(settingsPath) ?? Promise.resolve();
  const result = previous.then(mutation, mutation);
  const settled = result.then(
    () => void 0,
    () => void 0
  );
  mutationQueues.set(settingsPath, settled);
  void settled.finally(() => {
    if (mutationQueues.get(settingsPath) === settled) mutationQueues.delete(settingsPath);
  });
  return result;
}
async function readSettingsDocumentForUpdate(settingsPath, legacySettingsPath) {
  const canonical = await readSettingsSnapshot(settingsPath);
  if (canonical.result.kind === "loaded") return canonical.document ?? {};
  if (canonical.result.kind === "invalid") {
    throw invalidSettingsError(settingsPath, canonical.result.reason);
  }
  if (!legacySettingsPath) return {};
  const legacy = await readSettingsSnapshot(legacySettingsPath);
  const raced = await readSettingsSnapshot(settingsPath);
  if (raced.result.kind === "loaded") return raced.document ?? {};
  if (raced.result.kind === "invalid") {
    throw invalidSettingsError(settingsPath, raced.result.reason);
  }
  if (legacy.result.kind === "invalid") {
    throw invalidSettingsError(legacySettingsPath, legacy.result.reason);
  }
  return legacy.document ?? {};
}
async function readSettingsSnapshot(settingsPath) {
  let contents;
  try {
    contents = await readSettingsContents(settingsPath);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return { result: { kind: "missing" } };
    return { result: { kind: "invalid", reason: safeReadError(error) } };
  }
  let parsed;
  try {
    parsed = JSON.parse(contents);
  } catch {
    return { result: { kind: "invalid", reason: "invalid JSON" } };
  }
  const settings = normalizePlanModeSettings(parsed);
  if (!settings || !isSettingsDocument(parsed)) {
    return { result: { kind: "invalid", reason: "invalid settings shape" } };
  }
  return { document: parsed, result: { kind: "loaded", settings } };
}
async function readSettingsContents(settingsPath) {
  const flags = constants.O_RDONLY | (constants.O_NONBLOCK ?? 0) | (constants.O_NOFOLLOW ?? 0);
  const handle = await open(settingsPath, flags);
  try {
    const stats = await handle.stat();
    if (!stats.isFile()) throw new Error("settings path is not a regular file");
    if (stats.size > MAX_SETTINGS_BYTES) {
      throw new Error(`settings file exceeds ${MAX_SETTINGS_BYTES} bytes`);
    }
    const buffer = Buffer.alloc(MAX_SETTINGS_BYTES + 1);
    let offset = 0;
    while (offset < buffer.byteLength) {
      const { bytesRead } = await handle.read(buffer, offset, buffer.byteLength - offset, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    if (offset > MAX_SETTINGS_BYTES) {
      throw new Error(`settings file exceeds ${MAX_SETTINGS_BYTES} bytes`);
    }
    try {
      return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
        buffer.subarray(0, offset)
      );
    } catch {
      throw new Error("settings file is not valid UTF-8");
    }
  } finally {
    await handle.close();
  }
}
async function publishSettings(settingsPath, document, signal, beforeRename) {
  signal?.throwIfAborted();
  const contents = `${JSON.stringify(document, null, 2)}
`;
  if (Buffer.byteLength(contents, "utf8") > MAX_SETTINGS_BYTES) {
    throw new Error(`settings document exceeds ${MAX_SETTINGS_BYTES} bytes`);
  }
  const directory = dirname(settingsPath);
  await mkdir(directory, { recursive: true });
  signal?.throwIfAborted();
  const temporaryPath = join(
    directory,
    `.${basename(settingsPath)}.${process.pid}.${randomUUID2()}.tmp`
  );
  try {
    await writeFile(temporaryPath, contents, {
      encoding: "utf8",
      flag: "wx",
      mode: 384,
      signal
    });
    await beforeRename?.(temporaryPath, settingsPath);
    signal?.throwIfAborted();
    await rename(temporaryPath, settingsPath);
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => void 0);
  }
}
function isSettingsDocument(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
async function pathExists(path) {
  try {
    const handle = await open(path, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0));
    await handle.close();
    return true;
  } catch (error) {
    return !(isNodeError(error) && error.code === "ENOENT");
  }
}
function invalidSettingsError(settingsPath, reason) {
  return new Error(`pi-plan-mode settings at ${settingsPath} are invalid: ${reason}`);
}
function isNodeError(error) {
  return error instanceof Error && "code" in error;
}
function safeReadError(error) {
  if (isNodeError(error) && error.code === "ELOOP") return "settings path is not a regular file";
  return error instanceof Error ? error.message : String(error);
}
function configuredThinkingLevel(settings) {
  return settings.thinkingLevel === "inherit" ? void 0 : settings.thinkingLevel;
}
function configuredImplementationPlanRetention(settings) {
  return settings.implementationPlanRetention ?? "keep";
}
function configuredPlanExportPath(settings) {
  return settings.defaultPlanExportPath ?? DEFAULT_PLAN_EXPORT_PATH;
}
var PLAN_MODE_SETTINGS_FILE, LEGACY_PLAN_MODE_SETTINGS_FILE, MAX_SETTINGS_BYTES, PLAN_MODE_THINKING_LEVELS, IMPLEMENTATION_PLAN_RETENTIONS, DEFAULT_PLAN_EXPORT_PATH, MAX_PLAN_EXPORT_PATH_LENGTH, mutationQueues;
var init_settings = __esm({
  "packages/pi-plan-mode/src/settings.ts"() {
    "use strict";
    init_tool_policy();
    PLAN_MODE_SETTINGS_FILE = "pi-plan-mode.json";
    LEGACY_PLAN_MODE_SETTINGS_FILE = "plan-mode.json";
    MAX_SETTINGS_BYTES = 64 * 1024;
    PLAN_MODE_THINKING_LEVELS = [
      "inherit",
      "off",
      "minimal",
      "low",
      "medium",
      "high",
      "xhigh",
      "max"
    ];
    IMPLEMENTATION_PLAN_RETENTIONS = [
      "keep",
      "clear-on-start",
      "clear-after-first-run"
    ];
    DEFAULT_PLAN_EXPORT_PATH = "PLAN.md";
    MAX_PLAN_EXPORT_PATH_LENGTH = 4096;
    mutationQueues = /* @__PURE__ */ new Map();
  }
});

// packages/pi-plan-mode/src/plan-export.ts
import { mkdir as mkdir2, writeFile as writeFile2 } from "node:fs/promises";
import { dirname as dirname2, resolve } from "node:path";
import { stripVTControlCharacters } from "node:util";
import { withFileMutationQueue } from "@earendil-works/pi-coding-agent";
async function exportStoredPlan(state, requestedPath, ctx, lifecycle, defaultPath = DEFAULT_PLAN_EXPORT_PATH) {
  const plan = (state.enabled ? state.latestPlan : void 0)?.trim() ?? state.savedPlan?.plan.trim() ?? state.activeImplementation?.plan.trim();
  if (!plan) {
    const error = new Error(
      "No completed plan is available to export. Use /plan finalize when planning is complete."
    );
    if (!ctx.hasUI) throw error;
    ctx.ui.notify(error.message, "warning");
    return false;
  }
  const isCurrent = () => !lifecycle || lifecycle.isCurrent() && (!lifecycle.getState || lifecycle.getState() === state);
  let result;
  try {
    result = await exportPlanToFile(
      plan,
      requestedPath,
      ctx.cwd,
      lifecycle?.signal,
      isCurrent,
      defaultPath
    );
  } catch (error) {
    if (lifecycle?.signal.aborted || !isCurrent()) return false;
    if (!ctx.hasUI) throw error;
    const detail2 = error instanceof Error ? error.message : String(error);
    ctx.ui.notify(safeNotification(`Unable to export plan: ${detail2}`), "error");
    return false;
  }
  if (!isCurrent()) return false;
  const finishedReady = state.enabled && Boolean(state.latestPlan?.trim()) && lifecycle?.finishReady !== void 0;
  if (finishedReady) lifecycle.finishReady?.();
  const detail = finishedReady ? " Plan mode disabled." : "";
  ctx.ui.notify(safeNotification(`Plan exported to ${result.path}.${detail}`), "info");
  return true;
}
async function exportPlanToFile(plan, requestedPath, cwd, signal, isCurrent = () => true, defaultPath = DEFAULT_PLAN_EXPORT_PATH) {
  const path = resolvePlanExportPath(requestedPath, cwd, defaultPath);
  await withFileMutationQueue(path, async () => {
    throwIfCancelled(signal, isCurrent);
    await mkdir2(dirname2(path), { recursive: true });
    throwIfCancelled(signal, isCurrent);
    try {
      await writeFile2(path, `${plan}
`, { encoding: "utf8", flag: "wx" });
    } catch (error) {
      if (isNodeError2(error) && error.code === "EEXIST") {
        throw new Error(
          `Plan export target already exists: ${path}. Choose another path or remove it first.`
        );
      }
      throw error;
    }
  });
  return { path };
}
function planExportDestination(defaultPath, cwd) {
  return {
    configuredPath: safeNotification(defaultPath),
    resolvedPath: safeNotification(resolvePlanExportPath(void 0, cwd, defaultPath))
  };
}
function resolvePlanExportPath(requestedPath, cwd, defaultPath = DEFAULT_PLAN_EXPORT_PATH) {
  const rawPath = requestedPath?.trim() || defaultPath;
  const normalizedPath = rawPath.startsWith("@") ? rawPath.slice(1) : rawPath;
  if (!normalizedPath.trim()) throw new Error("Plan export path must not be empty.");
  if (normalizedPath.includes("\0")) {
    throw new Error("Plan export path must not contain NUL bytes.");
  }
  return resolve(cwd, normalizedPath);
}
function safeNotification(value) {
  let sanitized = "";
  for (const character of stripVTControlCharacters(value)) {
    const codePoint = character.codePointAt(0);
    sanitized += codePoint !== void 0 && codePoint > 31 && !(codePoint >= 127 && codePoint <= 159) ? character : " ";
  }
  return sanitized;
}
function throwIfCancelled(signal, isCurrent) {
  if (!signal?.aborted && isCurrent()) return;
  throw signal?.reason instanceof Error ? signal.reason : new DOMException("Plan export cancelled", "AbortError");
}
function isNodeError2(error) {
  return error instanceof Error && "code" in error;
}
var init_plan_export = __esm({
  "packages/pi-plan-mode/src/plan-export.ts"() {
    "use strict";
    init_settings();
  }
});

// packages/pi-plan-mode/src/question-tool.ts
function normalizePlanModeQuestionParams(input) {
  if (!isRecord2(input) || !Array.isArray(input.questions)) {
    return { ok: false, error: "questions must be an array" };
  }
  if (input.questions.length < 1 || input.questions.length > 3) {
    return { ok: false, error: "questions must contain 1-3 items" };
  }
  const questions = [];
  for (const [questionIndex, rawQuestion] of input.questions.entries()) {
    if (!isRecord2(rawQuestion)) {
      return { ok: false, error: `question ${questionIndex + 1} must be an object` };
    }
    const id = stringField(rawQuestion.id);
    const header = stringField(rawQuestion.header);
    const question = stringField(rawQuestion.question);
    if (!id || !header || !question) {
      return {
        ok: false,
        error: `question ${questionIndex + 1} requires non-empty id, header, and question`
      };
    }
    if (!Array.isArray(rawQuestion.options)) {
      return { ok: false, error: `question ${questionIndex + 1} options must be an array` };
    }
    if (rawQuestion.options.length < 2 || rawQuestion.options.length > 4) {
      return { ok: false, error: `question ${questionIndex + 1} options must contain 2-4 items` };
    }
    const options = [];
    for (const [optionIndex, rawOption] of rawQuestion.options.entries()) {
      if (!isRecord2(rawOption)) {
        return {
          ok: false,
          error: `question ${questionIndex + 1} option ${optionIndex + 1} must be an object`
        };
      }
      const label = stringField(rawOption.label);
      if (!label) {
        return {
          ok: false,
          error: `question ${questionIndex + 1} option ${optionIndex + 1} requires a label`
        };
      }
      const description = stringField(rawOption.description);
      if (!description) {
        return {
          ok: false,
          error: `question ${questionIndex + 1} option ${optionIndex + 1} requires a description`
        };
      }
      options.push({ label, description });
    }
    questions.push({ id, header, question, options });
  }
  return { ok: true, questions };
}
async function answerPlanModeQuestions(questions, ctx, lifecycle) {
  const answers = await askPlanModeQuestions(
    questions,
    ctx,
    () => lifecycle.isCurrent() && lifecycle.isEnabled()
  );
  if (!lifecycle.isCurrent()) {
    return planModeQuestionCancelled(
      questions,
      "cancelled",
      "Plan-mode question cancelled because the session changed."
    );
  }
  if (!lifecycle.isEnabled()) {
    return planModeQuestionCancelled(
      questions,
      "plan_mode_inactive",
      "Plan-mode question cancelled because Plan mode is no longer active."
    );
  }
  if (!answers) {
    return planModeQuestionCancelled(
      questions,
      "cancelled",
      "User cancelled the Plan-mode question prompt."
    );
  }
  return planModeQuestionAnswered(questions, answers);
}
async function askPlanModeQuestions(questions, ctx, shouldContinue = () => true) {
  const answers = [];
  for (const question of questions) {
    const choices = question.options.map(formatPlanModeQuestionChoice);
    const otherChoice = `${question.options.length + 1}. Other (free-form)`;
    const choice = await ctx.ui.select(`${question.header}: ${question.question}`, [
      ...choices,
      otherChoice
    ]);
    if (!shouldContinue() || !choice) return void 0;
    if (choice === otherChoice) {
      const customAnswer = (await ctx.ui.editor(question.question, ""))?.trim();
      if (!shouldContinue() || !customAnswer) return void 0;
      answers.push({
        id: question.id,
        header: question.header,
        question: question.question,
        answer: customAnswer,
        wasCustom: true
      });
      continue;
    }
    const optionIndex = choices.indexOf(choice);
    const option = question.options[optionIndex];
    if (!option) return void 0;
    answers.push({
      id: question.id,
      header: question.header,
      question: question.question,
      answer: option.label,
      wasCustom: false,
      optionIndex: optionIndex + 1
    });
  }
  return answers;
}
function formatPlanModeQuestionChoice(option, index) {
  return `${index + 1}. ${option.label}${option.description ? ` \u2014 ${option.description}` : ""}`;
}
function planModeQuestionAnswered(questions, answers) {
  return {
    content: [
      { type: "text", text: formatPlanModeQuestionPayload({ cancelled: false, answers }) }
    ],
    details: { cancelled: false, questions, answers }
  };
}
function planModeQuestionCancelled(questions, reason, message) {
  return {
    content: [
      {
        type: "text",
        text: formatPlanModeQuestionPayload({ cancelled: true, reason, message })
      }
    ],
    details: { cancelled: true, reason, questions }
  };
}
function formatPlanModeQuestionPayload(payload) {
  return JSON.stringify(payload, null, 2);
}
function isRecord2(value) {
  return typeof value === "object" && value !== null;
}
function stringField(value) {
  return typeof value === "string" ? value.trim() : void 0;
}
var PLAN_MODE_QUESTION_TOOL_NAME, PLAN_MODE_QUESTION_PARAMS;
var init_question_tool = __esm({
  "packages/pi-plan-mode/src/question-tool.ts"() {
    "use strict";
    PLAN_MODE_QUESTION_TOOL_NAME = "plan_mode_question";
    PLAN_MODE_QUESTION_PARAMS = {
      type: "object",
      additionalProperties: false,
      required: ["questions"],
      properties: {
        questions: {
          type: "array",
          minItems: 1,
          maxItems: 3,
          description: "Questions to show the user. Prefer 1 and do not exceed 3.",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "header", "question", "options"],
            properties: {
              id: {
                type: "string",
                description: "Stable identifier for mapping answers (snake_case)."
              },
              header: {
                type: "string",
                description: "Short header label shown in the UI (12 or fewer chars)."
              },
              question: { type: "string", description: "Single-sentence prompt shown to the user." },
              options: {
                type: "array",
                minItems: 2,
                maxItems: 4,
                description: "Provide 2-4 mutually exclusive choices. Put the recommended option first when there is a clear default.",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["label", "description"],
                  properties: {
                    label: { type: "string", description: "User-facing label (1-5 words)." },
                    description: {
                      type: "string",
                      description: "One short sentence explaining impact/tradeoff if selected."
                    }
                  }
                }
              }
            }
          }
        }
      }
    };
  }
});

// packages/pi-plan-mode/src/tool-selection.ts
function toolNameFromLegacyKey(key, tools) {
  const directName = tools.find((tool) => tool.name === key)?.name;
  if (directName) return directName;
  const [name] = key.split("");
  return tools.find((tool) => tool.name === name) ? name : void 0;
}
function compareTools(left, right) {
  const leftBuiltin = isBuiltinTool(left);
  const rightBuiltin = isBuiltinTool(right);
  if (leftBuiltin !== rightBuiltin) return leftBuiltin ? -1 : 1;
  return left.name.localeCompare(right.name);
}
function toolPolicyLabel(tool) {
  const policy = classifyPlanModeTool(tool);
  if (policy === "read-only") return "built-in read-only";
  if (policy === "limited") return "built-in limited";
  if (policy === "blocked") return "built-in blocked";
  return `user opt-in: ${toolSourceLabel(tool)}`;
}
function toolSourceLabel(tool) {
  const sourceInfo = tool.sourceInfo;
  const source = `${sourceInfo.scope}/${sourceInfo.source}`;
  return sourceInfo.path ? `${source} ${sourceInfo.path}` : source;
}
function unique(values) {
  return Array.from(new Set(values));
}
function filterAvailableSelectedToolNames(names, tools) {
  const availableNames = new Set(tools.filter(canSelectToolInPlanMode).map((tool) => tool.name));
  return unique(names.filter((name) => availableNames.has(name)));
}
function defaultPlanModeToolNames(tools, configuredNames) {
  if (configuredNames !== void 0) {
    return filterAvailableSelectedToolNames(configuredNames, tools);
  }
  return tools.filter((tool) => isBuiltinTool(tool) && SAFE_BUILTIN_PLAN_TOOLS.has(tool.name)).map((tool) => tool.name);
}
function snapshotPlanModeSelectedNames(tools, selection) {
  const selectedToolNames = selection.selectedToolNames ?? selection.selectedToolKeys?.map((key) => toolNameFromLegacyKey(key, tools)).filter((name) => name !== void 0);
  return new Set(
    selectedToolNames === void 0 ? defaultPlanModeToolNames(tools, selection.defaultPlanTools) : filterAvailableSelectedToolNames(selectedToolNames, tools)
  );
}
function snapshotPlanModeToolNames(tools, selectedNames, selection) {
  if (tools.length === 0 && selection.selectedToolNames === void 0 && selection.selectedToolKeys === void 0 && selection.defaultPlanTools === void 0) {
    return ["read", "bash", PLAN_MODE_QUESTION_TOOL_NAME, PLAN_MODE_COMPLETE_TOOL_NAME];
  }
  return withRequiredPlanModeTools(
    tools.filter((tool) => selectedNames.has(tool.name) && canSelectToolInPlanMode(tool)).map((tool) => tool.name)
  );
}
var init_tool_selection = __esm({
  "packages/pi-plan-mode/src/tool-selection.ts"() {
    "use strict";
    init_completion_tool();
    init_question_tool();
    init_required_tools();
    init_tool_policy();
  }
});

// packages/pi-plan-mode/src/required-tools.ts
function withRequiredPlanModeTools(toolNames) {
  return unique([
    ...withoutRequiredPlanModeTools(toolNames),
    PLAN_MODE_QUESTION_TOOL_NAME,
    PLAN_MODE_COMPLETE_TOOL_NAME
  ]);
}
function withoutRequiredPlanModeTools(toolNames) {
  return toolNames.filter(
    (toolName) => toolName !== PLAN_MODE_QUESTION_TOOL_NAME && toolName !== PLAN_MODE_COMPLETE_TOOL_NAME
  );
}
var init_required_tools = __esm({
  "packages/pi-plan-mode/src/required-tools.ts"() {
    "use strict";
    init_completion_tool();
    init_question_tool();
    init_tool_selection();
  }
});

// packages/pi-plan-mode/src/plan-export-screen.ts
function planExportInputScreen(getDestination) {
  const destination = getDestination();
  return {
    kind: "input",
    title: "Export plan",
    lines: [
      "Existing paths are never overwritten.",
      `Default: ${destination.configuredPath}`,
      `Resolves to: ${destination.resolvedPath}`
    ],
    placeholder: destination.configuredPath,
    action: "export",
    hint: "back"
  };
}
var init_plan_export_screen = __esm({
  "packages/pi-plan-mode/src/plan-export-screen.ts"() {
    "use strict";
  }
});

// packages/pi-plan-mode/src/active-implementation-menu.ts
import { defineMenu, runMenu } from "@narumitw/pi-tui-kit";
async function showActiveImplementationMenu(ctx, options) {
  const menu = defineMenu({
    start: "active",
    screens: {
      active: () => ({
        kind: "actions",
        title: "Active implementation plan",
        lines: [options.statusText],
        items: [
          { id: "show", label: "Show active implementation plan", action: "show" },
          { id: "export", label: "Export plan\u2026", to: "export" },
          { id: "settings", label: "Settings", action: "settings" },
          { id: "start-new", label: "Start a new plan", action: "start-new" },
          { id: "clear", label: "Clear active implementation plan", action: "clear" }
        ],
        hint: "close"
      }),
      export: () => planExportInputScreen(options.getExportDestination)
    },
    actions: {
      show: async () => {
        options.show();
        return { kind: "close" };
      },
      export: async ({ value, signal }) => await options.exportPlan(value ?? "", signal) ? { kind: "close" } : { kind: "rejected" },
      settings: async ({ signal }) => {
        const close = await options.settings(signal);
        if (signal.aborted || !options.isCurrent()) return { kind: "rejected" };
        return close ? { kind: "close" } : { kind: "stay" };
      },
      "start-new": async () => {
        options.startNew();
        return { kind: "close" };
      },
      clear: async () => {
        options.clear();
        return { kind: "close" };
      }
    }
  });
  await runMenu(ctx, menu, {
    getState: () => void 0,
    signal: options.signal,
    isCurrent: options.isCurrent
  });
}
var init_active_implementation_menu = __esm({
  "packages/pi-plan-mode/src/active-implementation-menu.ts"() {
    "use strict";
    init_plan_export_screen();
  }
});

// packages/pi-plan-mode/src/plan-action-menus.ts
import { defineMenu as defineMenu2, runMenu as runMenu2 } from "@narumitw/pi-tui-kit";
async function showPlanModeMenu(ctx, options) {
  const menu = defineMenu2({
    start: "main",
    screens: {
      main: () => ({
        kind: "actions",
        title: "Plan mode",
        lines: [
          options.statusText,
          ...options.hasReadyPlan ? [...IMPLEMENTATION_CONTEXT_LINES, options.implementationOutcome()] : []
        ],
        items: options.hasReadyPlan ? [
          { id: "show", label: "Show latest proposed plan", action: "show" },
          {
            id: "implement-here",
            label: "Implement here",
            description: "Continue in this session with the planning conversation.",
            action: "implement-here"
          },
          {
            id: "implement-fresh",
            label: "Start fresh and implement",
            description: "Open a new linked session; transfer only the approved plan.",
            action: "implement-fresh",
            busyLabel: "Starting fresh implementation session\u2026"
          },
          { id: "export", label: "Export plan\u2026", to: "export" },
          { id: "save", label: "Save for later", action: "save" },
          { id: "stay", label: "Stay in Plan mode", action: "stay" },
          { id: "exit", label: "Discard plan and exit", action: "exit" }
        ] : [
          { id: "finalize", label: "Request final plan", action: "finalize" },
          { id: "stay", label: "Stay in Plan mode", action: "stay" },
          { id: "exit", label: "Exit Plan mode", action: "exit" }
        ],
        hint: "close"
      }),
      export: () => planExportInputScreen(options.getExportDestination)
    },
    actions: {
      show: async () => {
        options.show();
        return { kind: "close" };
      },
      finalize: async () => {
        options.finalize();
        return { kind: "close" };
      },
      "implement-here": async () => {
        await options.implementHere();
        return { kind: "close" };
      },
      "implement-fresh": async ({ signal }) => {
        await options.implementFresh(signal);
        return { kind: "close" };
      },
      export: async ({ value, signal }) => await options.exportPlan(value ?? "", signal) ? { kind: "close" } : { kind: "rejected" },
      save: async () => {
        options.save();
        return { kind: "close" };
      },
      stay: async () => {
        options.stay();
        return { kind: "close" };
      },
      exit: async () => {
        options.exit();
        return { kind: "close" };
      }
    }
  });
  await runMenu2(ctx, menu, {
    getState: () => void 0,
    signal: options.signal,
    isCurrent: options.isCurrent
  });
}
async function showReadyPlanMenu(ctx, options) {
  const menu = defineMenu2({
    start: "ready",
    screens: {
      ready: () => ({
        kind: "actions",
        title: "Proposed plan ready. What next?",
        lines: [...IMPLEMENTATION_CONTEXT_LINES, options.implementationOutcome()],
        items: [
          {
            id: "implement-here",
            label: "Implement here",
            description: "Continue in this session with the planning conversation.",
            action: "implement-here"
          },
          {
            id: "implement-fresh",
            label: "Start fresh and implement",
            description: "Open a new linked session; transfer only the approved plan.",
            action: "implement-fresh",
            busyLabel: "Starting fresh implementation session\u2026"
          },
          { id: "export", label: "Export plan\u2026", to: "export" },
          { id: "save", label: "Save for later", action: "save" },
          { id: "stay", label: "Stay in Plan mode", action: "stay" },
          { id: "exit", label: "Discard plan and exit", action: "exit" }
        ],
        hint: "close"
      }),
      export: () => planExportInputScreen(options.getExportDestination)
    },
    actions: {
      "implement-here": async () => {
        await options.implementHere();
        return { kind: "close" };
      },
      "implement-fresh": async ({ signal }) => {
        await options.implementFresh(signal);
        return { kind: "close" };
      },
      export: async ({ value, signal }) => await options.exportPlan(value ?? "", signal) ? { kind: "close" } : { kind: "rejected" },
      save: async () => {
        options.save();
        return { kind: "close" };
      },
      stay: async () => {
        options.stay();
        return { kind: "close" };
      },
      exit: async () => {
        options.exit();
        return { kind: "close" };
      }
    }
  });
  await runMenu2(ctx, menu, {
    getState: () => void 0,
    signal: options.signal,
    isCurrent: options.isCurrent
  });
}
var IMPLEMENTATION_CONTEXT_LINES;
var init_plan_action_menus = __esm({
  "packages/pi-plan-mode/src/plan-action-menus.ts"() {
    "use strict";
    init_plan_export_screen();
    IMPLEMENTATION_CONTEXT_LINES = [
      "Implement here keeps this planning conversation.",
      "Start fresh transfers only the approved plan to a new session."
    ];
  }
});

// packages/pi-plan-mode/src/plan-launch-menu.ts
import { defineMenu as defineMenu3, runMenu as runMenu3 } from "@narumitw/pi-tui-kit";
async function showPlanLaunchMenu(ctx, options) {
  const selectedNames = new Set(options.getSelectedNames());
  let draftChanged = false;
  const menu = defineMenu3({
    start: options.initialScreen ?? "main",
    screens: {
      main: () => ({
        kind: "actions",
        title: "Plan mode",
        lines: [options.statusText, options.toolSummary(selectedNames)],
        items: [
          { id: "start", label: "Start Plan mode", action: "start" },
          { id: "tools", label: "Choose tools, then start\u2026", to: "tools" },
          { id: "settings", label: "Settings", action: "settings" },
          { id: "help", label: "How Plan mode works", to: "help" }
        ],
        hint: "close"
      }),
      tools: () => ({
        kind: "multiSelect",
        title: "Choose Plan-mode tools",
        lines: [
          "Changes apply only when you start Plan mode.",
          "Non-built-in tools run at user risk."
        ],
        enableSearch: true,
        viewportSize: 10,
        items: options.tools.map((tool) => ({
          id: tool.name,
          label: tool.name,
          description: tool.description,
          searchText: tool.searchText,
          selected: selectedNames.has(tool.name),
          disabled: tool.disabled,
          disabledReason: tool.disabledReason
        })),
        action: "toggle-tool",
        actions: [
          {
            id: "start-with-tools",
            label: "Done \u2014 start Plan mode",
            action: "start-with-tools"
          }
        ],
        hint: "back"
      }),
      help: () => ({
        kind: "detail",
        title: "How Plan mode works",
        lines: [
          "Plan mode uses read-only exploration to understand the project before implementation.",
          "The agent can ask important decision questions, then returns a complete implementation-ready plan.",
          "File mutation stays blocked until you explicitly choose to implement the completed plan."
        ],
        hint: "back"
      })
    },
    actions: {
      start: async ({ signal }) => {
        if (signal.aborted || !options.isCurrent()) return { kind: "rejected" };
        options.start(signal);
        return { kind: "close" };
      },
      "toggle-tool": async ({ itemId, selected, signal }) => {
        if (signal.aborted || !options.isCurrent()) return { kind: "rejected" };
        const tool = options.tools.find((candidate) => candidate.name === itemId);
        if (!tool || tool.disabled) return { kind: "rejected" };
        if (selected) selectedNames.add(tool.name);
        else selectedNames.delete(tool.name);
        draftChanged = true;
        return { kind: "stay" };
      },
      "start-with-tools": async ({ signal }) => {
        if (signal.aborted || !options.isCurrent()) return { kind: "rejected" };
        options.startWithTools(Array.from(selectedNames), signal);
        return { kind: "close" };
      },
      settings: async ({ signal }) => {
        if (signal.aborted || !options.isCurrent()) return { kind: "rejected" };
        const close = await options.settings(signal);
        if (signal.aborted || !options.isCurrent()) return { kind: "rejected" };
        if (close) return { kind: "close" };
        if (!draftChanged) {
          selectedNames.clear();
          for (const name of options.getSelectedNames()) selectedNames.add(name);
        }
        return { kind: "stay" };
      }
    }
  });
  await runMenu3(ctx, menu, {
    getState: () => void 0,
    signal: options.signal,
    isCurrent: options.isCurrent
  });
}
var init_plan_launch_menu = __esm({
  "packages/pi-plan-mode/src/plan-launch-menu.ts"() {
    "use strict";
  }
});

// packages/pi-plan-mode/src/saved-plan-menu.ts
import { defineMenu as defineMenu4, runMenu as runMenu4 } from "@narumitw/pi-tui-kit";
async function showSavedPlanMenu(ctx, options) {
  if (!ctx.hasUI) {
    throw new Error(
      `${options.statusText} Use /plan show, /plan implement, /plan export, or /plan exit.`
    );
  }
  const menu = defineMenu4({
    start: "saved",
    screens: {
      saved: () => ({
        kind: "actions",
        title: "Saved plan",
        lines: [
          options.statusText,
          "Implement here keeps this planning conversation.",
          "Start fresh transfers only the approved plan to a new session.",
          options.implementationOutcome()
        ],
        items: [
          { id: "show", label: "Show saved plan", action: "show" },
          {
            id: "implement-here",
            label: "Implement here",
            description: "Continue in this session with the planning conversation.",
            action: "implement-here"
          },
          {
            id: "implement-fresh",
            label: "Start fresh and implement",
            description: "Open a new linked session; transfer only the approved plan.",
            action: "implement-fresh",
            busyLabel: "Starting fresh implementation session\u2026"
          },
          { id: "export", label: "Export plan\u2026", to: "export" },
          { id: "settings", label: "Settings", action: "settings" },
          { id: "clear", label: "Clear saved plan", action: "clear" }
        ],
        hint: "close"
      }),
      export: () => planExportInputScreen(options.getExportDestination)
    },
    actions: {
      show: async () => {
        options.show();
        return { kind: "close" };
      },
      "implement-here": async () => {
        await options.implementHere();
        return { kind: "close" };
      },
      "implement-fresh": async ({ signal }) => {
        await options.implementFresh(signal);
        return { kind: "close" };
      },
      export: async ({ value, signal }) => await options.exportPlan(value ?? "", signal) ? { kind: "close" } : { kind: "rejected" },
      settings: async ({ signal }) => {
        const close = await options.settings(signal);
        if (signal.aborted || !options.isCurrent()) return { kind: "rejected" };
        return close ? { kind: "close" } : { kind: "stay" };
      },
      clear: async () => {
        options.clear();
        return { kind: "close" };
      }
    }
  });
  await runMenu4(ctx, menu, {
    getState: () => void 0,
    signal: options.signal,
    isCurrent: options.isCurrent
  });
}
var init_saved_plan_menu = __esm({
  "packages/pi-plan-mode/src/saved-plan-menu.ts"() {
    "use strict";
    init_plan_export_screen();
  }
});

// packages/pi-plan-mode/src/settings-menu.ts
import { defineMenu as defineMenu5, runMenu as runMenu5 } from "@narumitw/pi-tui-kit";
async function showPlanModeSettings(ctx, options) {
  const settingsPath = options.settingsPath ?? planModeSettingsPath();
  const readSettings = options.readSettings ?? readPlanModeSettings;
  const updateSettings = options.updateSettings ?? updatePlanModeSettings;
  const tools = options.tools.filter(
    (tool) => tool.name !== PLAN_MODE_QUESTION_TOOL_NAME && tool.name !== PLAN_MODE_COMPLETE_TOOL_NAME
  );
  const loadState = async () => {
    const loaded = await readSettings(options.settingsPath);
    if (loaded.kind === "invalid") {
      return {
        kind: "invalid",
        settings: { thinkingLevel: "inherit" },
        notice: loaded.notice,
        reason: loaded.reason
      };
    }
    return {
      kind: "valid",
      settings: loaded.kind === "loaded" ? loaded.settings : { thinkingLevel: "inherit" },
      notice: loaded.notice
    };
  };
  const menu = defineMenu5({
    start: "settings",
    screens: {
      settings: ({ state }) => state.kind === "invalid" ? invalidScreen(settingsPath, state) : {
        kind: "settings",
        title: "Plan Mode Settings",
        lines: settingsLines(settingsPath, state.notice),
        items: [
          {
            id: "thinkingLevel",
            label: "Plan thinking",
            description: "Set the thinking level when the next Plan workflow starts.",
            currentValue: state.settings.thinkingLevel,
            values: PLAN_MODE_THINKING_LEVELS,
            action: "set-thinking"
          },
          {
            id: "defaultPlanTools",
            label: "Plan tools",
            description: "Choose persistent defaults; a launch-time selection still overrides them for that session.",
            currentValue: defaultToolsValue(state.settings.defaultPlanTools),
            action: "open-tools"
          },
          {
            id: "implementationPlanRetention",
            label: "After Implement",
            description: "Choose how long the accepted plan keeps guiding implementation.",
            currentValue: retentionLabel(
              configuredImplementationPlanRetention(state.settings)
            ),
            values: IMPLEMENTATION_PLAN_RETENTIONS.map(retentionLabel),
            action: "set-retention"
          },
          {
            id: "defaultPlanExportPath",
            label: "Export destination",
            description: "Set the destination used when an export omits its path.",
            currentValue: safeTerminalText(configuredPlanExportPath(state.settings)),
            action: "open-export"
          }
        ]
      },
      tools: ({ state }) => ({
        kind: "multiSelect",
        title: "Default Plan-mode tools",
        lines: [
          "Changes apply when a later Plan workflow starts; required Plan tools stay enabled.",
          "Non-built-in tools run at user risk."
        ],
        enableSearch: true,
        viewportSize: 10,
        items: defaultToolItems(tools, state.settings.defaultPlanTools),
        action: "toggle-tool",
        actions: [
          {
            id: "reset-tools",
            label: "Use automatic safe built-ins",
            action: "reset-tools"
          }
        ],
        hint: "back"
      }),
      export: ({ state }) => {
        const configured = configuredPlanExportPath(state.settings);
        const destination = planExportDestination(configured, ctx.cwd);
        return {
          kind: "input",
          title: "Export destination",
          lines: [
            `Configured: ${destination.configuredPath}`,
            `Resolves here to: ${destination.resolvedPath}`,
            "Submit an empty value to reset to PLAN.md. Changes affect the next export."
          ],
          placeholder: configured,
          action: "set-export",
          hint: "back"
        };
      }
    },
    actions: {
      "set-thinking": async ({ ctx: actionCtx, value, signal }) => {
        if (!PLAN_MODE_THINKING_LEVELS.includes(value)) {
          return { kind: "rejected" };
        }
        return savePatch(
          actionCtx,
          { thinkingLevel: value },
          signal,
          `Plan mode thinking level: ${value}. Applies to the next Plan workflow.`
        );
      },
      "open-tools": async () => ({ kind: "to", screen: "tools" }),
      "set-retention": async ({ ctx: actionCtx, value, signal }) => {
        const implementationPlanRetention = retentionFromLabel(value);
        if (!implementationPlanRetention) return { kind: "rejected" };
        return savePatch(
          actionCtx,
          { implementationPlanRetention },
          signal,
          `After Implement: ${retentionLabel(implementationPlanRetention)}. Applies to the next Implement action.`
        );
      },
      "open-export": async () => ({ kind: "to", screen: "export" }),
      "set-export": async ({ ctx: actionCtx, value, signal }) => {
        const defaultPlanExportPath = value?.trim() || null;
        const result = await savePatch(
          actionCtx,
          { defaultPlanExportPath },
          signal,
          defaultPlanExportPath ? `Default Plan export destination: ${safeTerminalText(defaultPlanExportPath)}.` : "Default Plan export destination reset to PLAN.md."
        );
        return result.kind === "stay" ? { kind: "to", screen: "settings" } : result;
      },
      "toggle-tool": async ({ ctx: actionCtx, state, itemId, selected, signal }) => {
        const tool = tools.find((candidate) => candidate.name === itemId);
        if (!tool || !canSelectToolInPlanMode(tool)) return { kind: "rejected" };
        const names = explicitToolNames(tools, state.settings.defaultPlanTools);
        const next = selected ? Array.from(/* @__PURE__ */ new Set([...names, tool.name])) : names.filter((name) => name !== tool.name);
        return savePatch(
          actionCtx,
          { defaultPlanTools: next },
          signal,
          `Default Plan-mode tools: ${next.length === 0 ? "required tools only" : `${next.length} selected`}.`
        );
      },
      "reset-tools": async ({ ctx: actionCtx, state, signal }) => {
        if (state.settings.defaultPlanTools === void 0) return { kind: "stay" };
        return savePatch(
          actionCtx,
          { defaultPlanTools: null },
          signal,
          "Default Plan-mode tools: automatic safe built-ins."
        );
      }
    }
  });
  return runMenu5(ctx, menu, {
    getState: loadState,
    signal: options.signal,
    isCurrent: options.isCurrent
  });
  async function savePatch(actionCtx, patch, signal, successMessage) {
    if (signal.aborted || !options.isCurrent()) return { kind: "rejected" };
    try {
      const saved = await updateSettings(patch, {
        settingsPath: options.settingsPath,
        legacySettingsPath: options.legacySettingsPath,
        signal
      });
      if (options.isCurrent()) options.onSaved(saved);
      if (signal.aborted || !options.isCurrent()) return { kind: "rejected" };
      actionCtx.ui.notify(successMessage, "info");
      return { kind: "stay" };
    } catch (error) {
      if (!signal.aborted && options.isCurrent()) {
        actionCtx.ui.notify(
          `Could not save Plan mode settings; the previous value remains: ${safeTerminalText(formatError(error))}`,
          "error"
        );
      }
      return { kind: "rejected" };
    }
  }
}
function settingsLines(settingsPath, notice) {
  return [
    `User settings \xB7 ${safeTerminalText(settingsPath)}`,
    "Plan defaults apply to the next workflow; handoff and export choices apply to their next action.",
    ...notice ? [safeTerminalText(notice)] : []
  ];
}
function invalidScreen(settingsPath, state) {
  return {
    kind: "detail",
    title: "Plan Mode Settings \xB7 Read only",
    lines: [
      `Invalid settings file. Fix ${safeTerminalText(settingsPath)} before saving.`,
      safeTerminalText(state.reason ?? "The settings file is invalid."),
      ...state.notice ? [safeTerminalText(state.notice)] : []
    ],
    hint: "back"
  };
}
function retentionFromLabel(value) {
  return IMPLEMENTATION_PLAN_RETENTIONS.find((retention) => retentionLabel(retention) === value);
}
function defaultToolsValue(configured) {
  if (configured === void 0) return "Automatic safe built-ins";
  if (configured.length === 0) return "Required tools only";
  return `${configured.length} selected`;
}
function defaultToolItems(tools, configured) {
  const selected = new Set(explicitToolNames(tools, configured));
  const availableNames = new Set(tools.map((tool) => tool.name));
  const items = tools.map((tool) => {
    const selectable = canSelectToolInPlanMode(tool);
    const policy = toolPolicyLabel(tool);
    const description = tool.description ?? "No description available";
    return {
      id: tool.name,
      label: tool.name,
      description: `${policy} \xB7 ${description}`,
      searchText: `${policy} ${description}`,
      selected: selected.has(tool.name),
      disabled: !selectable,
      disabledReason: selectable ? void 0 : "Blocked by Plan-mode policy"
    };
  });
  for (const name of configured ?? []) {
    if (availableNames.has(name)) continue;
    items.push({
      id: name,
      label: name,
      description: "unavailable \xB7 Retained in settings but unavailable in this session",
      searchText: "unavailable retained settings",
      selected: true,
      disabled: true,
      disabledReason: "Unavailable in this session; reset defaults to remove unavailable names"
    });
  }
  return items;
}
function explicitToolNames(tools, configured) {
  return configured === void 0 ? defaultPlanModeToolNames([...tools], void 0) : [...configured];
}
function safeTerminalText(value) {
  return [...value].map((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint >= 127 && codePoint <= 159 ? " " : character;
  }).join("").trim();
}
function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}
var init_settings_menu = __esm({
  "packages/pi-plan-mode/src/settings-menu.ts"() {
    "use strict";
    init_completion_tool();
    init_implementation_retention();
    init_plan_export();
    init_question_tool();
    init_settings();
    init_tool_policy();
    init_tool_selection();
  }
});

// packages/pi-plan-mode/src/interactive-ui.ts
var interactive_ui_exports = {};
__export(interactive_ui_exports, {
  showActiveImplementationMenu: () => showActiveImplementationMenu,
  showPlanLaunchMenu: () => showPlanLaunchMenu,
  showPlanModeMenu: () => showPlanModeMenu,
  showPlanModeSettings: () => showPlanModeSettings,
  showReadyPlanMenu: () => showReadyPlanMenu,
  showSavedPlanMenu: () => showSavedPlanMenu
});
var init_interactive_ui = __esm({
  "packages/pi-plan-mode/src/interactive-ui.ts"() {
    "use strict";
    init_active_implementation_menu();
    init_plan_action_menus();
    init_plan_launch_menu();
    init_saved_plan_menu();
    init_settings_menu();
  }
});

// packages/pi-plan-mode/src/plan-mode.ts
import { randomUUID as randomUUID3 } from "node:crypto";

// packages/pi-plan-mode/src/command.ts
var PLAN_COMMAND_COMPLETIONS = [
  { value: "start", label: "start", description: "Start Plan mode without sending a prompt" },
  { value: "show", label: "show", description: "Show the ready, saved, or active plan" },
  { value: "finalize", label: "finalize", description: "Request a completed plan" },
  { value: "implement", label: "implement", description: "Implement the completed or saved plan" },
  { value: "save", label: "save", description: "Save the completed plan for later" },
  { value: "export", label: "export", description: "Export the stored plan to a Markdown file" },
  { value: "exit", label: "exit", description: "Leave Plan mode or clear a saved/active plan" },
  { value: "off", label: "off", description: "Leave Plan mode or clear a saved/active plan" },
  {
    value: "tools",
    label: "tools",
    description: "Choose tools before starting this Plan workflow"
  }
];
function completePlanArguments(argumentPrefix) {
  const prefix = argumentPrefix.trimStart().toLowerCase();
  if (prefix === "") return [...PLAN_COMMAND_COMPLETIONS];
  if (/\s/.test(prefix)) return null;
  const matches = PLAN_COMMAND_COMPLETIONS.filter((item) => item.value.startsWith(prefix));
  return matches.length > 0 ? [...matches] : null;
}

// packages/pi-plan-mode/src/plan-mode.ts
init_completion_tool();

// packages/pi-plan-mode/src/extension-runtime.ts
function onAgentSettled(pi, handler) {
  pi.on("agent_settled", handler);
}
function setPlanThinkingLevel(pi, level) {
  pi.setThinkingLevel(level);
}
function isStaleExtensionContextError(error) {
  return error instanceof Error && (error.message.includes("This extension ctx is stale after session replacement or reload") || error.message.includes("Extension context is no longer active"));
}

// packages/pi-plan-mode/src/fresh-implementation.ts
import { randomUUID } from "node:crypto";
function formatImplementationHandoff(plan) {
  return `Plan mode is now disabled. Full tool access is restored. Implement this proposed plan now:

${plan}`;
}
async function startFreshImplementationFromState(ctx, options) {
  if (!isCommandContext(ctx)) {
    ctx.ui.notify(
      "Fresh implementation requires the interactive /plan command. Reopen /plan and try again.",
      "warning"
    );
    return { kind: "rejected" };
  }
  const initialState = options.getState();
  const savedPlan = initialState.enabled ? void 0 : initialState.savedPlan;
  const plan = (initialState.enabled ? initialState.latestPlan : savedPlan?.plan)?.trim();
  const source = initialState.enabled ? initialState.latestPlanSource : savedPlan?.source;
  if (!plan || !source) {
    ctx.ui.notify("No completed plan is available to implement.", "warning");
    return { kind: "rejected" };
  }
  const wasEnabled = initialState.enabled;
  const isCurrent = () => {
    const current = options.getState();
    return options.menuIsCurrent() && current.enabled === wasEnabled && (wasEnabled ? current.latestPlan === plan && current.latestPlanSource === source : current.savedPlan === savedPlan);
  };
  return startFreshImplementationSession(ctx, {
    plan,
    source,
    retention: options.retention,
    stateEntryType: options.stateEntryType,
    isCurrent
  });
}
async function startFreshImplementationSession(ctx, request) {
  if (ctx.mode === "print" || ctx.mode === "json") {
    throw new Error("Fresh plan implementation is unavailable in print/JSON mode. Use TUI or RPC.");
  }
  await ctx.waitForIdle();
  if (!request.isCurrent()) return { kind: "stale" };
  if (!await preflightModel(ctx, request.isCurrent)) return { kind: "rejected" };
  if (!request.isCurrent()) return { kind: "stale" };
  const activeImplementation = {
    id: randomUUID(),
    plan: request.plan,
    source: request.source,
    startedAt: Date.now(),
    retention: request.retention
  };
  const destinationState = {
    enabled: false,
    awaitingAction: false,
    activeImplementation
  };
  const handoff = formatImplementationHandoff(request.plan);
  const parentSession = ctx.sessionManager.getSessionFile();
  let setupError;
  let kickoffError;
  if (ctx.mode === "rpc") ctx.ui.notify("Starting fresh implementation session\u2026", "info");
  let result;
  try {
    result = await ctx.newSession({
      ...parentSession ? { parentSession } : {},
      setup: async (sessionManager) => {
        try {
          sessionManager.appendCustomEntry(request.stateEntryType, destinationState);
        } catch (error) {
          setupError = safeErrorDetail(error);
        }
      },
      withSession: async (replacementCtx) => {
        if (setupError) {
          recoverSetupFailure(replacementCtx, handoff, setupError);
          return;
        }
        try {
          await replacementCtx.sendUserMessage(handoff);
          replacementCtx.ui.notify(
            "Fresh implementation session started. Only the approved plan was transferred.",
            "info"
          );
        } catch (error) {
          kickoffError = safeErrorDetail(error);
          replacementCtx.ui.notify(
            `Fresh session created, but implementation did not start: ${kickoffError}. Send a message to continue, use /plan exit to clear the active plan, or resume the parent planning session.`,
            "error"
          );
        }
      }
    });
  } catch (error) {
    safeNotify(
      ctx,
      `Unable to start a fresh implementation session: ${safeErrorDetail(error)}. The source plan remains available; retry or resume the planning session.`,
      "error"
    );
    return { kind: "rejected" };
  }
  if (result.cancelled) {
    ctx.ui.notify("Fresh implementation cancelled. The plan remains available.", "info");
    return { kind: "cancelled" };
  }
  return setupError || kickoffError ? { kind: "partial" } : { kind: "started" };
}
async function preflightModel(ctx, isCurrent) {
  const model = ctx.model;
  if (!model) {
    ctx.ui.notify("Unable to implement the plan: no model is selected.", "warning");
    return false;
  }
  let auth;
  try {
    auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
  } catch (error) {
    if (isCurrent()) {
      ctx.ui.notify(`Unable to implement the plan: ${safeErrorDetail(error)}`, "error");
    }
    return false;
  }
  if (!isCurrent()) return false;
  if (!auth.ok) {
    ctx.ui.notify(`Unable to implement the plan: ${safeErrorDetail(auth.error)}`, "warning");
    return false;
  }
  return true;
}
function recoverSetupFailure(ctx, handoff, setupError) {
  ctx.ui.setEditorText(handoff);
  ctx.ui.notify(
    `Fresh session created, but the active plan could not be saved: ${setupError}. The implementation request is in the editor; submit it to continue or resume the parent planning session.`,
    "error"
  );
}
function safeNotify(ctx, message, level) {
  try {
    ctx.ui.notify(message, level);
  } catch {
  }
}
function isCommandContext(ctx) {
  return typeof ctx.newSession === "function";
}
function safeErrorDetail(error) {
  const detail = error instanceof Error ? error.message : String(error);
  const normalized = [...detail].map((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint >= 127 && codePoint <= 159 ? " " : character;
  }).join("").replace(/\s+/gu, " ").trim() || "unknown error";
  const characters = [...normalized];
  return characters.length > 500 ? `${characters.slice(0, 499).join("")}\u2026` : normalized;
}

// packages/pi-plan-mode/src/plan-mode.ts
init_implementation_retention();
init_message_transform();

// packages/pi-plan-mode/src/plan-action-controller.ts
function createPlanActionController(options) {
  const freshAction = (ctx, lifecycle, signal) => options.implementFresh(ctx, () => lifecycle.isCurrent() && !signal.aborted);
  return {
    async showSaved(ctx) {
      const lifecycle = options.captureLifecycle();
      if (!lifecycle.isCurrent() || lifecycle.signal.aborted) return;
      const ui = await options.loadInteractiveUi();
      if (!lifecycle.isCurrent() || lifecycle.signal.aborted) return;
      await ui.showSavedPlanMenu(ctx, {
        statusText: options.statusText(),
        implementationOutcome: options.implementationOutcome,
        getExportDestination: () => options.getExportDestination(ctx),
        signal: lifecycle.signal,
        isCurrent: lifecycle.isCurrent,
        show: () => options.show(ctx),
        implementHere: () => options.implementHere(ctx),
        implementFresh: (signal) => freshAction(ctx, lifecycle, signal),
        exportPlan: (path, signal) => options.exportPlan(ctx, path, signal, lifecycle.isCurrent),
        settings: (signal) => options.settings(ctx, signal, lifecycle.isCurrent),
        clear: () => options.clearSaved(ctx)
      });
    },
    async showCurrent(ctx) {
      if (!ctx.hasUI) {
        ctx.ui.notify(options.statusText(), "info");
        return;
      }
      const lifecycle = options.captureLifecycle();
      if (!lifecycle.isCurrent() || lifecycle.signal.aborted) return;
      const ui = await options.loadInteractiveUi();
      if (!lifecycle.isCurrent() || lifecycle.signal.aborted) return;
      await ui.showPlanModeMenu(ctx, {
        statusText: options.statusText(),
        hasReadyPlan: options.getState().latestPlan !== void 0,
        implementationOutcome: options.implementationOutcome,
        getExportDestination: () => options.getExportDestination(ctx),
        ...lifecycle,
        show: () => options.show(ctx),
        finalize: () => options.finalize(ctx),
        implementHere: () => options.implementHere(ctx),
        implementFresh: (signal) => freshAction(ctx, lifecycle, signal),
        exportPlan: (path, signal) => options.exportPlan(ctx, path, signal, lifecycle.isCurrent),
        save: () => options.save(ctx),
        stay: () => options.stay(ctx),
        exit: () => options.exitReady(ctx)
      });
    },
    async showReady(ctx) {
      const lifecycle = options.captureLifecycle();
      if (!lifecycle.isCurrent() || lifecycle.signal.aborted) return;
      const ui = await options.loadInteractiveUi();
      if (!lifecycle.isCurrent() || lifecycle.signal.aborted) return;
      await ui.showReadyPlanMenu(ctx, {
        ...lifecycle,
        implementationOutcome: options.implementationOutcome,
        getExportDestination: () => options.getExportDestination(ctx),
        implementHere: () => options.implementHere(ctx),
        implementFresh: (signal) => freshAction(ctx, lifecycle, signal),
        exportPlan: (path, signal) => options.exportPlan(ctx, path, signal, lifecycle.isCurrent),
        save: () => options.save(ctx),
        stay: () => void 0,
        exit: () => options.exitReady(ctx)
      });
    }
  };
}

// packages/pi-plan-mode/src/plan-export-controller.ts
init_plan_export();
init_settings();
function createPlanExportController(options) {
  return {
    export(path, ctx, signal, isCurrent) {
      const state = options.getState();
      return exportStoredPlan(
        state,
        path,
        ctx,
        {
          signal,
          isCurrent,
          getState: options.getState,
          finishReady: () => options.finishReady(ctx)
        },
        configuredPlanExportPath(options.getSettings())
      );
    },
    getDestination(ctx) {
      return planExportDestination(configuredPlanExportPath(options.getSettings()), ctx.cwd);
    }
  };
}

// packages/pi-plan-mode/src/presentation.ts
var STATUS_KEY = "plan-mode";
var PLAN_WIDGET_KEY = "plan-mode-plan";
function updatePlanModeUi(ctx, state, toolSummary) {
  ctx.ui.setStatus(STATUS_KEY, formatStatus(state));
  if (state.enabled && state.latestPlan) {
    ctx.ui.setWidget(PLAN_WIDGET_KEY, [
      "Proposed plan ready",
      "Use /plan to implement, save, revise, or exit Plan mode."
    ]);
  } else if (state.enabled) {
    ctx.ui.setWidget(PLAN_WIDGET_KEY, [
      "Plan mode: planning",
      toolSummary(),
      "Finish with plan_mode_complete when decision-ready."
    ]);
  } else if (state.savedPlan) {
    ctx.ui.setWidget(PLAN_WIDGET_KEY, [
      "Plan saved for later",
      "Use /plan to show, implement, or clear it."
    ]);
  } else if (state.activeImplementation) {
    ctx.ui.setWidget(PLAN_WIDGET_KEY, [
      "Implementation plan active",
      "Use /plan to show, replace, or clear it."
    ]);
  } else {
    ctx.ui.setWidget(PLAN_WIDGET_KEY, void 0);
  }
}
function clearPlanModeUi(ctx) {
  ctx.ui.setStatus(STATUS_KEY, void 0);
  ctx.ui.setWidget(PLAN_WIDGET_KEY, void 0);
}
function showStoredPlan(pi, ctx, state) {
  const readyPlan = state.enabled ? state.latestPlan?.trim() : void 0;
  const savedPlan = state.savedPlan?.plan.trim();
  if (savedPlan && (ctx.mode === "print" || ctx.mode === "json")) {
    throw new Error("Saved plan display is unavailable in print/JSON mode. Use TUI or RPC.");
  }
  const activePlan = state.activeImplementation?.plan.trim();
  const plan = readyPlan ?? savedPlan ?? activePlan;
  if (!plan) {
    ctx.ui.notify(
      "No completed plan is available. Use /plan finalize when planning is complete.",
      "info"
    );
    return;
  }
  const title = readyPlan ? "Proposed Plan" : savedPlan ? "Saved Plan" : "Active Implementation Plan";
  showPlanModePlan(pi, ctx, title, plan);
}
function showPlanModePlan(pi, ctx, title, plan) {
  try {
    pi.sendMessage(
      {
        customType: "proposed-plan",
        content: `**${title}**

${plan}`,
        display: true
      },
      { triggerTurn: false }
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    ctx.ui.notify(`Unable to show completed plan: ${detail}`, "error");
  }
}
function planModeStatusText(state, toolSummary) {
  if (state.enabled) {
    if (state.latestPlan) {
      return `Plan mode is active and a proposed plan is ready. ${toolSummary()}`;
    }
    return `Plan mode is active. ${toolSummary()} Explore, ask, and finish with plan_mode_complete when decision-ready.`;
  }
  if (state.savedPlan) return "A plan is saved for later.";
  if (state.activeImplementation) return "An implementation plan is active.";
  return "Plan mode is off.";
}
function formatStatus(state) {
  if (state.enabled) {
    if (state.awaitingAction || state.latestPlan) return "plan ready";
    return "plan active";
  }
  if (state.savedPlan) return "plan saved";
  if (state.activeImplementation) return "plan implementing";
  return void 0;
}

// packages/pi-plan-mode/src/prompt.ts
var PLAN_CONTEXT_MARKER = "[CODEX-LIKE PLAN MODE ACTIVE]";
function buildPlanModePrompt() {
  return `${PLAN_CONTEXT_MARKER}
# Plan Mode (Conversational)

You are in Plan Mode, a Codex-like collaboration mode for producing a decision-complete implementation plan. Chat your way to the plan before finalizing it. A final plan must leave no implementation decisions unresolved.

## Mode rules

- Stay in Plan Mode until a developer or extension explicitly exits it.
- Treat requests to implement as requests to plan the implementation; do not edit files or carry out the plan.
- Do not use update_plan/TODO tooling in Plan Mode; Plan Mode is conversational planning, not execution progress tracking.
- Plan Mode manages built-in tool safety only. Non-built-in tools are disabled by default and may be enabled by the user at their own risk.
- Do not perform mutating actions: no edit/write tools, no patching, no formatting that rewrites files, no dependency installation, no commits, no migrations.

## Phase 1 \u2014 Ground in the environment

- Explore first and ask second. Use non-mutating exploration to read files, search, inspect configuration, run read-only checks, and resolve discoverable facts.
- Before asking the user any question, perform at least one targeted non-mutating exploration pass unless no local environment or repository is available.
- Do not ask questions that can be answered from repository or system truth. Ask only when multiple plausible choices remain, a needed identifier/context is missing, or the ambiguity is product intent.

## Phase 2 \u2014 Intent chat

- Keep asking until you can clearly state the goal, success criteria, in/out of scope, constraints, current state, and key preferences/tradeoffs.
- Bias toward questions over guessing: if a high-impact ambiguity remains, do not produce a proposed plan yet.
- For an unanswered preference or tradeoff, use the recommended option only when it is low risk and record that default as an explicit assumption in the final plan.

## Phase 3 \u2014 Implementation chat

- Once intent is stable, keep asking until the spec is decision-complete: approach, interfaces, data flow, edge cases/failure modes, testing and acceptance criteria, and any migration or compatibility constraints.
- Use plan_mode_question for important preferences, tradeoffs, or assumption locks that cannot be discovered by non-mutating exploration. Ask 1-3 concise questions with 2-4 meaningful options. Do not include filler options.
- If plan_mode_question returns cancelled or ui_unavailable, do not jump straight to a final plan when the missing answer is high impact. Ask one concise plain-text question or proceed only with a clearly stated low-risk assumption.

## Ending each turn

Every Plan-mode turn that advances or finalizes the plan must end in exactly one of these ways:

- If a material decision remains, use plan_mode_question. If interactive UI is unavailable, ask one concise plain-text question instead.
- If the implementation plan is decision-complete, call plan_mode_complete alone as your final action. Do not call other tools in the same batch and do not emit a normal assistant response after it.

If a follow-up asks only for clarification and does not change or challenge the plan, answer it directly, then call plan_mode_complete alone as the final action with the complete unchanged plan so it remains available for implementation.

Never end with prose that merely announces you are about to present, write, or finalize the plan. Submit the actual plan with plan_mode_complete in that turn.

## Completion rule

Only call plan_mode_complete when the plan leaves no implementation decisions unresolved. Pass the complete plan as Markdown with:

- A clear title
- A brief summary
- Important changes to behavior, public APIs, interfaces, or types
- Test cases and verification scenarios
- Explicit assumptions and defaults chosen where needed

Keep the plan concise, human and agent digestible, and free of open decisions. Prefer grouped behavior-level changes over file-by-file or symbol-by-symbol inventories. Do not ask "should I proceed?"; plan_mode_complete opens the Plan-mode ready flow.

If the user requests revisions after a completed plan, the next plan_mode_complete call must contain a complete replacement, not a delta. If there is not enough information for a complete replacement, continue planning with plan_mode_question instead of calling plan_mode_complete.`;
}

// packages/pi-plan-mode/src/plan-mode.ts
init_question_tool();
init_required_tools();

// packages/pi-plan-mode/src/saved-plan-preflight.ts
function savedPlanBlocksNewWorkflow(ctx, hasSavedPlan) {
  if (!hasSavedPlan) return false;
  const message = "A plan is saved for later. Implement or clear it before starting another Plan-mode workflow.";
  if (!ctx.hasUI) throw new Error(message);
  ctx.ui.notify(message, "warning");
  return true;
}
async function preflightSavedPlanImplementation(ctx, isCurrent) {
  if (ctx.mode === "print" || ctx.mode === "json") {
    throw new Error("Saved plan implementation is unavailable in print/JSON mode. Use TUI or RPC.");
  }
  const model = ctx.model;
  if (!model) {
    ctx.ui.notify("Unable to implement saved plan: no model is selected.", "warning");
    return false;
  }
  let auth;
  try {
    auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
  } catch (error) {
    if (!isCurrent()) return false;
    const detail = error instanceof Error ? error.message : String(error);
    ctx.ui.notify(`Unable to implement saved plan: ${detail}`, "error");
    return false;
  }
  if (!isCurrent()) return false;
  if (!auth.ok) {
    ctx.ui.notify(`Unable to implement saved plan: ${auth.error}`, "warning");
    return false;
  }
  return true;
}

// packages/pi-plan-mode/src/plan-mode.ts
init_settings();

// packages/pi-plan-mode/src/state.ts
init_completion_tool();
init_settings();
function restorePlanModeState(entries, stateEntryType) {
  const branch = entries;
  let stateEntryIndex = -1;
  for (let index = branch.length - 1; index >= 0; index -= 1) {
    const candidate = branch[index];
    if (candidate?.type === "custom" && candidate.customType === stateEntryType) {
      stateEntryIndex = index;
      break;
    }
  }
  const entry = branch[stateEntryIndex];
  if (!isRecord3(entry?.data)) return { enabled: false, awaitingAction: false };
  const enabled = entry.data.enabled === true;
  const persistedSource = enabled ? planCompletionSource(entry.data.latestPlanSource) : void 0;
  const persistedPlan = enabled ? normalizePersistedPlan(entry.data.latestPlan) : void 0;
  const recoveredPlan = enabled && !persistedPlan ? latestCompletionPlan(branch.slice(stateEntryIndex + 1)) : void 0;
  const latestPlan = persistedPlan ?? recoveredPlan;
  const activeImplementation = enabled ? void 0 : normalizeActiveImplementation(entry.data.activeImplementation);
  const savedPlan = enabled || activeImplementation ? void 0 : normalizeSavedPlan(entry.data.savedPlan);
  return {
    enabled,
    latestPlan,
    latestPlanSource: enabled ? (persistedPlan ? persistedSource : void 0) ?? (recoveredPlan ? PLAN_MODE_COMPLETE_TOOL_NAME : void 0) : void 0,
    awaitingAction: enabled && latestPlan !== void 0,
    savedPlan,
    activeImplementation,
    selectedToolNames: stringArray(entry.data.selectedToolNames),
    selectedToolKeys: stringArray(entry.data.selectedToolKeys),
    previousThinkingLevel: enabled ? fixedThinkingLevel(entry.data.previousThinkingLevel) : void 0,
    appliedThinkingLevel: enabled ? fixedThinkingLevel(entry.data.appliedThinkingLevel) : void 0,
    manualThinkingLevel: enabled ? fixedThinkingLevel(entry.data.manualThinkingLevel) : void 0
  };
}
function normalizeSavedPlan(value) {
  if (!isRecord3(value)) return void 0;
  const source = planCompletionSource(value.source);
  const normalized = normalizePlanModeCompletion({ plan: value.plan });
  if (!source || !normalized.ok) return void 0;
  return { plan: normalized.plan, source };
}
function normalizeActiveImplementation(value) {
  if (!isRecord3(value)) return void 0;
  const id = typeof value.id === "string" && /^[A-Za-z0-9._:-]{1,128}$/u.test(value.id) ? value.id : void 0;
  const source = planCompletionSource(value.source);
  const normalized = normalizePlanModeCompletion({ plan: value.plan });
  const startedAt = typeof value.startedAt === "number" && Number.isSafeInteger(value.startedAt) && value.startedAt >= 0 ? value.startedAt : void 0;
  if (!id || !source || !normalized.ok || startedAt === void 0) return void 0;
  const retention = IMPLEMENTATION_PLAN_RETENTIONS.includes(
    value.retention
  ) ? value.retention : "keep";
  return { id, plan: normalized.plan, source, startedAt, retention };
}
function normalizePersistedPlan(value) {
  const normalized = normalizePlanModeCompletion({ plan: value });
  return normalized.ok ? normalized.plan : void 0;
}
function latestCompletionPlan(entries) {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const message = entries[index]?.message;
    if (message?.role !== "toolResult" || message.toolName !== PLAN_MODE_COMPLETE_TOOL_NAME) {
      continue;
    }
    const plan = planFromCompletionDetails(message.details);
    if (plan) return plan;
  }
  return void 0;
}
function planCompletionSource(value) {
  return value === PLAN_MODE_COMPLETE_TOOL_NAME || value === "legacy_proposed_plan" ? value : void 0;
}
function fixedThinkingLevel(value) {
  return typeof value === "string" && value !== "inherit" && PLAN_MODE_THINKING_LEVELS.includes(value) ? value : void 0;
}
function stringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? Array.from(new Set(value)) : void 0;
}
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// packages/pi-plan-mode/src/plan-mode.ts
init_tool_policy();
init_tool_selection();
init_message_transform();
init_question_tool();
init_required_tools();
init_settings();
init_tool_policy();
var STATE_ENTRY_TYPE = "plan-mode-state";
var PROPOSED_PLAN_MESSAGE_TYPE2 = "proposed-plan";
var BLOCKED_BUILTIN_TOOLS2 = /* @__PURE__ */ new Set(["edit", "write"]);
var DEFAULT_TOOLS = ["read", "bash", "edit", "write"];
function planMode(pi, dependencies = {}) {
  let interactiveUiPromise;
  const loadInteractiveUi = () => {
    if (dependencies.loadInteractiveUi) return dependencies.loadInteractiveUi();
    if (!interactiveUiPromise) {
      interactiveUiPromise = Promise.resolve().then(() => (init_interactive_ui(), interactive_ui_exports)).catch((error) => {
        interactiveUiPromise = void 0;
        throw error;
      });
    }
    return interactiveUiPromise;
  };
  let state = { enabled: false, awaitingAction: false };
  let settings = { thinkingLevel: "inherit" };
  let previousTools;
  let readyPresentationIntent;
  let latestCommandContext;
  let nextReadyPresentationNonce = 0;
  let menuGeneration = 0;
  let workflowGeneration = 0;
  let refreshStateBeforeFirstAgentStart = false;
  let menuController = new AbortController();
  const implementationRetention = createImplementationRetentionCoordinator();
  const persistState = () => pi.appendEntry(STATE_ENTRY_TYPE, state);
  const planExports = createPlanExportController({
    getState: () => state,
    getSettings: () => settings,
    finishReady: (ctx) => exitPlanMode(ctx)
  });
  const planActions = createPlanActionController({
    loadInteractiveUi,
    getState: () => state,
    captureLifecycle: captureMenuLifecycle,
    statusText: planStatusText,
    implementationOutcome,
    getExportDestination: (ctx) => planExports.getDestination(ctx),
    show: (ctx) => showStoredPlan(pi, ctx, state),
    finalize: requestFinalPlan,
    implementHere: startImplementation,
    implementFresh: startFreshImplementation,
    exportPlan: (ctx, path, signal, isCurrent) => planExports.export(path, ctx, signal, isCurrent),
    settings: showSettings,
    save: savePlanForLater,
    stay: updateUi,
    exitReady: (ctx) => {
      exitPlanMode(ctx);
      ctx.ui.notify("Plan mode disabled. Proposed plan discarded.", "info");
    },
    clearSaved: (ctx) => {
      exitPlanMode(ctx);
      ctx.ui.notify("Saved plan cleared.", "info");
    }
  });
  pi.registerFlag("plan", {
    description: "Start in Codex-like Plan mode",
    type: "boolean",
    default: false
  });
  pi.registerTool({
    name: PLAN_MODE_QUESTION_TOOL_NAME,
    label: "Plan question",
    description: "Ask the user one to three Plan-mode clarification questions with meaningful options, then wait for the answer. Only available while Plan mode is active.",
    promptSnippet: "Ask user decision questions while Plan mode is active",
    promptGuidelines: [
      "In Plan mode, use plan_mode_question for important preferences, tradeoffs, or assumptions that cannot be discovered from read-only exploration."
    ],
    parameters: PLAN_MODE_QUESTION_PARAMS,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!state.enabled) {
        return planModeQuestionCancelled(
          [],
          "plan_mode_inactive",
          "Error: plan_mode_question is only available while Plan mode is active."
        );
      }
      const parsed = normalizePlanModeQuestionParams(params);
      if (!parsed.ok) {
        return planModeQuestionCancelled([], "invalid_input", `Error: ${parsed.error}`);
      }
      if (!ctx.hasUI) {
        return planModeQuestionCancelled(
          parsed.questions,
          "ui_unavailable",
          "Unable to ask Plan-mode questions because interactive UI is not available."
        );
      }
      const sessionGeneration = menuGeneration;
      const questionWorkflowGeneration = workflowGeneration;
      return answerPlanModeQuestions(parsed.questions, ctx, {
        isCurrent: () => sessionGeneration === menuGeneration && questionWorkflowGeneration === workflowGeneration,
        isEnabled: () => state.enabled
      });
    }
  });
  pi.registerTool({
    name: PLAN_MODE_COMPLETE_TOOL_NAME,
    label: "Complete plan",
    description: "Submit the complete decision-ready implementation plan for user review. Only available while Plan mode is active, and must be the final standalone action.",
    promptSnippet: "Submit the final Plan-mode implementation plan",
    promptGuidelines: [
      "Call plan_mode_complete alone as the final action only after the implementation plan is decision-complete."
    ],
    parameters: PLAN_MODE_COMPLETE_PARAMS,
    renderResult: renderPlanModeCompletion,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!state.enabled) {
        throw new Error("plan_mode_complete is only available while Plan mode is active");
      }
      const parsed = normalizePlanModeCompletion(params);
      if (!parsed.ok) throw new Error(parsed.error);
      acceptCompletedPlan(parsed.plan, PLAN_MODE_COMPLETE_TOOL_NAME, ctx);
      return planModeCompleted(parsed.plan);
    }
  });
  pi.registerCommand("plan", {
    description: "Enter or manage Codex-like Plan mode",
    getArgumentCompletions: completePlanArguments,
    handler: async (args, ctx) => {
      latestCommandContext = ctx;
      const prompt = args.trim();
      const command = prompt.toLowerCase();
      if (command === "start") {
        if (savedPlanBlocksNewWorkflow(ctx, state.savedPlan !== void 0 && !state.enabled))
          return;
        if (state.enabled) {
          ctx.ui.notify("Plan mode is already active.", "info");
          return;
        }
        enterPlanMode(ctx);
        ctx.ui.notify("Plan mode enabled. I will explore and plan, but not modify files.", "info");
        return;
      }
      if (command === "show") {
        showStoredPlan(pi, ctx, state);
        return;
      }
      if (command === "finalize") {
        requestFinalPlan(ctx);
        return;
      }
      if (command === "implement") {
        if (!(state.enabled && state.latestPlan?.trim()) && !state.savedPlan?.plan.trim()) {
          ctx.ui.notify("No completed plan is available to implement.", "warning");
          return;
        }
        await startImplementation(ctx);
        return;
      }
      if (command === "save") {
        savePlanForLater(ctx);
        return;
      }
      const exportMatch = /^export(?:\s+([\s\S]+))?$/iu.exec(prompt);
      if (exportMatch) {
        const lifecycle = captureMenuLifecycle();
        await planExports.export(exportMatch[1], ctx, lifecycle.signal, lifecycle.isCurrent);
        return;
      }
      if (command === "exit" || command === "off") {
        const notification = state.activeImplementation ? "Active implementation plan cleared." : state.savedPlan ? "Saved plan cleared." : state.latestPlan ? "Plan mode disabled. Proposed plan discarded." : "Plan mode disabled.";
        exitPlanMode(ctx);
        ctx.ui.notify(notification, "info");
        return;
      }
      if (command === "tools") {
        if (savedPlanBlocksNewWorkflow(ctx, state.savedPlan !== void 0 && !state.enabled))
          return;
        if (state.enabled) {
          const message = "Plan-mode tools are locked while Planning is active. Exit Plan mode and choose tools before starting again.";
          if (!ctx.hasUI) throw new Error(message);
          ctx.ui.notify(message, "warning");
          return;
        }
        if (!ctx.hasUI) {
          throw new Error("/plan tools requires TUI or RPC mode and is unavailable here.");
        }
        await showLaunchMenu(ctx, "tools");
        return;
      }
      if (prompt) {
        if (savedPlanBlocksNewWorkflow(ctx, state.savedPlan !== void 0 && !state.enabled))
          return;
        enterPlanModeWithPrompt(prompt, ctx);
        return;
      }
      if (!ctx.hasUI) {
        throw new Error(
          "The interactive /plan menu is unavailable in print and JSON modes. Use /plan start or /plan <prompt>."
        );
      }
      if (!state.enabled) {
        if (state.activeImplementation && ctx.hasUI) {
          await showActivePlanMenu(ctx);
          return;
        }
        if (state.savedPlan) {
          await planActions.showSaved(ctx);
          return;
        }
        await showLaunchMenu(ctx);
        return;
      }
      await planActions.showCurrent(ctx);
    }
  });
  pi.on("session_start", async (event, ctx) => {
    const generation = ++menuGeneration;
    refreshStateBeforeFirstAgentStart = event.reason === "new";
    menuController.abort(new DOMException("Plan-mode session replaced", "AbortError"));
    menuController = new AbortController();
    readyPresentationIntent = void 0;
    latestCommandContext = void 0;
    implementationRetention.reset();
    settings = { thinkingLevel: "inherit" };
    restoreState(ctx);
    implementationRetention.restore(state.activeImplementation);
    const loadedSettings = await (dependencies.readSettings?.() ?? readPlanModeSettings());
    if (generation !== menuGeneration || menuController.signal.aborted) return;
    if (loadedSettings.kind === "loaded") settings = loadedSettings.settings;
    else if (loadedSettings.kind === "invalid") {
      ctx.ui.notify(`pi-plan-mode settings ignored: ${loadedSettings.reason}`, "warning");
    }
    if (loadedSettings.notice) ctx.ui.notify(loadedSettings.notice, "warning");
    const persistFlagActivation = pi.getFlag("plan") === true && !state.enabled;
    if (persistFlagActivation) {
      state = state.savedPlan ? {
        ...state,
        enabled: true,
        latestPlan: state.savedPlan.plan,
        latestPlanSource: state.savedPlan.source,
        awaitingAction: true,
        savedPlan: void 0,
        activeImplementation: void 0
      } : { ...state, enabled: true, activeImplementation: void 0 };
    }
    if (state.enabled) {
      activatePlanModeTools();
      applyPlanThinkingLevel();
    } else deactivatePlanModeQuestionTool();
    if (persistFlagActivation) persistState();
    updateUi(ctx);
  });
  pi.on("thinking_level_select", (event) => {
    if (!state.enabled || !state.appliedThinkingLevel) return;
    if (event.level !== state.appliedThinkingLevel) {
      state = {
        ...state,
        manualThinkingLevel: event.level,
        previousThinkingLevel: void 0,
        appliedThinkingLevel: void 0
      };
      persistState();
    }
  });
  pi.on("session_shutdown", async (_event, ctx) => {
    menuGeneration += 1;
    menuController.abort(new DOMException("Plan-mode session shut down", "AbortError"));
    readyPresentationIntent = void 0;
    latestCommandContext = void 0;
    refreshStateBeforeFirstAgentStart = false;
    implementationRetention.reset();
    await awaitPlanModeSettingsWrites(dependencies.settingsPath);
    captureManualThinkingLevel();
    persistState();
    if (state.enabled) {
      restoreTools();
      restoreThinkingLevel();
    }
    clearUi(ctx);
  });
  pi.on("tool_call", async (event) => {
    if (!state.enabled) return;
    if (event.toolName === "update_plan") {
      return {
        block: true,
        reason: "Plan mode blocks update_plan because it tracks execution progress rather than conversational planning."
      };
    }
    const calledTool = toolByName(event.toolName);
    if (calledTool && classifyPlanModeTool(calledTool) === "blocked") {
      return {
        block: true,
        reason: `Plan mode blocks built-in tool '${event.toolName}' because its policy class is blocked.`
      };
    }
    if (!calledTool && BLOCKED_BUILTIN_TOOLS2.has(event.toolName)) {
      return {
        block: true,
        reason: `Plan mode blocks built-in tool '${event.toolName}' because its metadata is unavailable.`
      };
    }
    if (event.toolName !== "bash") return;
    const blocked = findBlockedCommandSegment(readCommand(event.input), settings.safeSubcommands);
    if (blocked !== void 0) {
      return {
        block: true,
        reason: `Plan mode blocks bash commands outside its reviewed inspection policy or containing explicitly unsafe arguments.
Blocked command: ${blocked}`
      };
    }
  });
  pi.on("context", async (event, ctx) => {
    const result = implementationRetention.transformContext(event.messages, state);
    if (result.clearActiveImplementationId) {
      clearActiveImplementation(result.clearActiveImplementationId, ctx);
    }
    return { messages: result.messages };
  });
  pi.on("before_agent_start", (event, ctx) => {
    if (refreshStateBeforeFirstAgentStart) {
      refreshStateBeforeFirstAgentStart = false;
      restoreState(ctx);
      implementationRetention.reset();
      implementationRetention.restore(state.activeImplementation);
      if (state.enabled) {
        activatePlanModeTools();
        applyPlanThinkingLevel();
      } else deactivatePlanModeQuestionTool();
      updateUi(ctx);
    }
    if (!state.enabled) return;
    if (state.latestPlan || state.awaitingAction) {
      readyPresentationIntent = void 0;
      state = {
        ...state,
        latestPlan: void 0,
        latestPlanSource: void 0,
        awaitingAction: false
      };
      persistState();
      updateUi(ctx);
    }
    applyPlanModeTools();
    return {
      systemPrompt: `${event.systemPrompt}

${buildPlanModePrompt()}`
    };
  });
  pi.on("agent_end", async (event, ctx) => {
    if (!state.enabled) return;
    const text = latestAssistantText(event.messages);
    const parsedPlan = parseProposedPlan(text);
    if (parsedPlan.kind !== "valid") {
      if (parsedPlan.kind !== "absent") {
        ctx.ui.notify(invalidPlanMessage(parsedPlan.kind), "warning");
      }
      persistState();
      updateUi(ctx);
      return;
    }
    acceptCompletedPlan(parsedPlan.plan, "legacy_proposed_plan", ctx);
  });
  onAgentSettled(pi, async (_event, ctx) => {
    const settledImplementationId = implementationRetention.implementationSettled(
      state.activeImplementation
    );
    if (settledImplementationId) clearActiveImplementation(settledImplementationId, ctx);
    const intent = readyPresentationIntent;
    if (!intent || !readyPresentationIsCurrent(intent)) return;
    if (!ctx.isIdle() || ctx.hasPendingMessages()) return;
    readyPresentationIntent = void 0;
    try {
      if (intent.source === "legacy_proposed_plan") {
        pi.sendMessage(
          {
            customType: PROPOSED_PLAN_MESSAGE_TYPE2,
            content: `**Proposed Plan**

${intent.plan}`,
            display: true
          },
          { triggerTurn: false }
        );
      }
      if (ctx.hasUI && completedPlanIsCurrent(intent)) {
        await planActions.showReady(latestCommandContext ?? ctx);
      }
    } catch (error) {
      if (!isStaleExtensionContextError(error)) throw error;
    }
  });
  function enterPlanMode(ctx) {
    workflowGeneration += 1;
    if (!state.enabled) previousTools = withoutRequiredPlanModeTools(safeGetActiveTools());
    state = {
      ...state,
      enabled: true,
      awaitingAction: false,
      savedPlan: void 0,
      activeImplementation: void 0
    };
    activatePlanModeTools();
    applyPlanThinkingLevel();
    persistState();
    updateUi(ctx);
  }
  function enterPlanModeWithPrompt(prompt, ctx) {
    const previousState = state;
    const wasEnabled = state.enabled;
    enterPlanMode(ctx);
    if (!wasEnabled) {
      ctx.ui.notify("Plan mode enabled. I will explore and plan, but not modify files.", "info");
    }
    if (sendPlanModeUserMessage(prompt, ctx)) return;
    if (!previousState.enabled) {
      restoreTools();
      restoreThinkingLevel();
    }
    state = previousState;
    persistState();
    updateUi(ctx);
  }
  function exitPlanMode(ctx) {
    workflowGeneration += 1;
    const wasEnabled = state.enabled;
    readyPresentationIntent = void 0;
    state = {
      ...state,
      enabled: false,
      latestPlan: void 0,
      latestPlanSource: void 0,
      awaitingAction: false,
      savedPlan: void 0,
      activeImplementation: void 0,
      manualThinkingLevel: void 0
    };
    if (wasEnabled) {
      restoreTools();
      restoreThinkingLevel();
      state = { ...state, manualThinkingLevel: void 0 };
    }
    persistState();
    updateUi(ctx);
  }
  function sendPlanModeUserMessage(message, ctx) {
    try {
      if (ctx.isIdle()) pi.sendUserMessage(message);
      else pi.sendUserMessage(message, { deliverAs: "followUp" });
      return true;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      ctx.ui.notify(`Unable to send Plan-mode message: ${detail}`, "error");
      return false;
    }
  }
  function acceptCompletedPlan(plan, source, ctx) {
    const normalized = normalizePlanModeCompletion({ plan });
    if (!normalized.ok) {
      ctx.ui.notify(`Proposed plan is not ready: ${normalized.error}.`, "warning");
      persistState();
      updateUi(ctx);
      return;
    }
    if (state.enabled && state.awaitingAction && state.latestPlan === normalized.plan && state.latestPlanSource === source) {
      return;
    }
    state = {
      ...state,
      latestPlan: normalized.plan,
      latestPlanSource: source,
      awaitingAction: true
    };
    readyPresentationIntent = {
      nonce: ++nextReadyPresentationNonce,
      plan: normalized.plan,
      source
    };
    persistState();
    updateUi(ctx);
  }
  function completedPlanIsCurrent(intent) {
    return state.enabled && state.awaitingAction && state.latestPlan === intent.plan && state.latestPlanSource === intent.source;
  }
  function readyPresentationIsCurrent(intent) {
    return completedPlanIsCurrent(intent) && readyPresentationIntent?.nonce === intent.nonce;
  }
  function requestFinalPlan(ctx) {
    if (!state.enabled) {
      ctx.ui.notify("Plan mode is not active. Use /plan first.", "warning");
      return;
    }
    sendPlanModeUserMessage(
      "Finalize the current implementation plan now. If any material decision remains, use plan_mode_question instead. Otherwise call plan_mode_complete alone as your final action with the complete decision-ready plan.",
      ctx
    );
  }
  function savePlanForLater(ctx) {
    const plan = state.enabled ? state.latestPlan?.trim() : void 0;
    if (!plan) {
      const message = "No completed plan is available to save.";
      if (!ctx.hasUI) throw new Error(message);
      ctx.ui.notify(message, "warning");
      return;
    }
    const source = state.latestPlanSource ?? "legacy_proposed_plan";
    workflowGeneration += 1;
    readyPresentationIntent = void 0;
    state = {
      ...state,
      enabled: false,
      latestPlan: void 0,
      latestPlanSource: void 0,
      awaitingAction: false,
      savedPlan: { plan, source },
      activeImplementation: void 0,
      manualThinkingLevel: void 0
    };
    restoreTools();
    restoreThinkingLevel();
    state = { ...state, manualThinkingLevel: void 0 };
    persistState();
    updateUi(ctx);
    ctx.ui.notify("Plan saved for later. Plan mode disabled.", "info");
  }
  async function startFreshImplementation(ctx, menuIsCurrent) {
    await startFreshImplementationFromState(ctx, {
      getState: () => state,
      menuIsCurrent,
      retention: configuredImplementationPlanRetention(settings),
      stateEntryType: STATE_ENTRY_TYPE
    });
  }
  async function startImplementation(ctx) {
    const savedPlan = state.enabled ? void 0 : state.savedPlan;
    if (savedPlan) {
      const sessionGeneration = menuGeneration;
      const planWorkflowGeneration = workflowGeneration;
      const isCurrent = () => sessionGeneration === menuGeneration && planWorkflowGeneration === workflowGeneration && !menuController.signal.aborted && !state.enabled && state.savedPlan === savedPlan;
      if (!await preflightSavedPlanImplementation(ctx, isCurrent)) return;
    }
    const plan = (state.enabled ? state.latestPlan : savedPlan?.plan)?.trim();
    const source = (state.enabled ? state.latestPlanSource : savedPlan?.source) ?? "legacy_proposed_plan";
    if (!plan) {
      ctx.ui.notify("Plan mode disabled. No proposed plan is available to implement.", "warning");
      return;
    }
    workflowGeneration += 1;
    const previousState = state;
    const wasEnabled = state.enabled;
    readyPresentationIntent = void 0;
    state = {
      ...state,
      enabled: false,
      latestPlan: void 0,
      latestPlanSource: void 0,
      awaitingAction: false,
      savedPlan: void 0,
      activeImplementation: {
        id: randomUUID3(),
        plan,
        source,
        startedAt: Date.now(),
        retention: configuredImplementationPlanRetention(settings)
      },
      manualThinkingLevel: void 0
    };
    if (wasEnabled) {
      restoreTools();
      restoreThinkingLevel();
      state = { ...state, manualThinkingLevel: void 0 };
    }
    persistState();
    updateUi(ctx);
    const sent = sendPlanModeUserMessage(formatImplementationHandoff(plan), ctx);
    if (!sent) {
      if (savedPlan) {
        state = previousState;
      } else {
        enterPlanMode(ctx);
        state = previousState;
        applyPlanThinkingLevel();
      }
      persistState();
      updateUi(ctx);
    }
  }
  function clearActiveImplementation(id, ctx) {
    if (state.activeImplementation?.id !== id) return false;
    workflowGeneration += 1;
    state = { ...state, activeImplementation: void 0 };
    persistState();
    updateUi(ctx);
    return true;
  }
  async function showLaunchMenu(ctx, initialScreen = "main") {
    const lifecycle = captureMenuLifecycle();
    if (!lifecycle.isCurrent() || lifecycle.signal.aborted) return;
    const ui = await loadInteractiveUi();
    if (!lifecycle.isCurrent() || lifecycle.signal.aborted) return;
    const tools = selectableTools();
    await ui.showPlanLaunchMenu(ctx, {
      statusText: "Status: Off \u2014 normal tools are active.",
      initialScreen,
      getSelectedNames: () => snapshotPlanModeSelectedNames(tools, toolSelectionSnapshot()),
      toolSummary: (selectedNames) => `When started: ${snapshotPlanModeToolNames(tools, selectedNames, toolSelectionSnapshot()).join(", ")}`,
      tools: tools.map((tool) => {
        const selectable = canSelectToolInPlanMode(tool);
        const policy = toolPolicyLabel(tool);
        const description = tool.description ?? "No description available";
        return {
          name: tool.name,
          description: `${policy} \xB7 ${description}`,
          searchText: [policy, description].join(" "),
          disabled: !selectable,
          disabledReason: selectable ? void 0 : "Blocked by Plan-mode policy"
        };
      }),
      ...lifecycle,
      start: (signal) => {
        if (signal.aborted || !lifecycle.isCurrent()) return;
        enterPlanMode(ctx);
        ctx.ui.notify("Plan mode enabled. I will explore and plan, but not modify files.", "info");
      },
      startWithTools: (names, signal) => {
        if (signal.aborted || !lifecycle.isCurrent()) return;
        state = {
          ...state,
          selectedToolNames: filterAvailableSelectedToolNames(names, tools),
          selectedToolKeys: void 0
        };
        enterPlanMode(ctx);
        ctx.ui.notify("Plan mode enabled with the selected tools.", "info");
      },
      settings: (signal) => showSettings(ctx, signal, lifecycle.isCurrent)
    });
  }
  async function showActivePlanMenu(ctx) {
    if (!ctx.hasUI) {
      ctx.ui.notify(planStatusText(), "info");
      return;
    }
    const lifecycle = captureMenuLifecycle();
    if (!lifecycle.isCurrent() || lifecycle.signal.aborted) return;
    const ui = await loadInteractiveUi();
    if (!lifecycle.isCurrent() || lifecycle.signal.aborted) return;
    await ui.showActiveImplementationMenu(ctx, {
      statusText: planStatusText(),
      getExportDestination: () => planExports.getDestination(ctx),
      signal: lifecycle.signal,
      isCurrent: lifecycle.isCurrent,
      show: () => showStoredPlan(pi, ctx, state),
      exportPlan: (path, signal) => planExports.export(path, ctx, signal, lifecycle.isCurrent),
      settings: (signal) => showSettings(ctx, signal, lifecycle.isCurrent),
      startNew: () => {
        enterPlanMode(ctx);
        ctx.ui.notify("Plan mode enabled. I will explore and plan, but not modify files.", "info");
      },
      clear: () => {
        exitPlanMode(ctx);
        ctx.ui.notify("Active implementation plan cleared.", "info");
      }
    });
  }
  async function showSettings(ctx, signal, isCurrent) {
    if (!isCurrent() || signal.aborted) return false;
    const ui = await loadInteractiveUi();
    if (!isCurrent() || signal.aborted) return false;
    const result = await ui.showPlanModeSettings(ctx, {
      tools: selectableTools(),
      signal,
      isCurrent,
      settingsPath: dependencies.settingsPath,
      onSaved: (saved) => {
        if (isCurrent()) settings = saved;
      },
      ...dependencies.readSettings ? { readSettings: async () => dependencies.readSettings?.() ?? { kind: "missing" } } : {}
    });
    return result.kind === "closed" && "reason" in result && result.reason === "close";
  }
  function captureMenuLifecycle() {
    const sessionGeneration = menuGeneration;
    const planWorkflowGeneration = workflowGeneration;
    const controller = menuController;
    return {
      signal: controller.signal,
      isCurrent: () => sessionGeneration === menuGeneration && planWorkflowGeneration === workflowGeneration && !controller.signal.aborted
    };
  }
  function activatePlanModeTools() {
    previousTools ??= withoutRequiredPlanModeTools(safeGetActiveTools());
    applyPlanModeTools();
  }
  function applyPlanModeTools() {
    pi.setActiveTools(planModeToolNames());
  }
  function planModeToolNames() {
    const tools = selectableTools();
    if (tools.length === 0 && state.selectedToolNames === void 0 && state.selectedToolKeys === void 0 && settings.defaultPlanTools === void 0) {
      return ["read", "bash", PLAN_MODE_QUESTION_TOOL_NAME, PLAN_MODE_COMPLETE_TOOL_NAME];
    }
    const selectedNames = snapshotPlanModeSelectedNames(tools, toolSelectionSnapshot());
    return withRequiredPlanModeTools(
      tools.filter((tool) => selectedNames.has(tool.name) && canSelectToolInPlanMode(tool)).map((tool) => tool.name)
    );
  }
  function toolSelectionSnapshot() {
    return {
      selectedToolNames: state.selectedToolNames,
      selectedToolKeys: state.selectedToolKeys,
      defaultPlanTools: settings.defaultPlanTools
    };
  }
  function selectableTools() {
    return safeGetAllTools().filter(
      (tool) => tool.name !== PLAN_MODE_QUESTION_TOOL_NAME && tool.name !== PLAN_MODE_COMPLETE_TOOL_NAME
    ).sort(compareTools);
  }
  function safeGetAllTools() {
    try {
      return pi.getAllTools();
    } catch {
      return [];
    }
  }
  function restoreTools() {
    const restoredTools = previousTools ?? DEFAULT_TOOLS;
    pi.setActiveTools(withoutRequiredPlanModeTools(restoredTools));
    previousTools = void 0;
  }
  function applyPlanThinkingLevel() {
    if (state.manualThinkingLevel) {
      if (pi.getThinkingLevel() !== state.manualThinkingLevel) {
        setPlanThinkingLevel(pi, state.manualThinkingLevel);
      }
      return;
    }
    const configured = configuredThinkingLevel(settings);
    if (!configured) {
      state = {
        ...state,
        previousThinkingLevel: void 0,
        appliedThinkingLevel: void 0
      };
      return;
    }
    const current = pi.getThinkingLevel();
    if (!state.appliedThinkingLevel) state.previousThinkingLevel = current;
    if (current !== configured) setPlanThinkingLevel(pi, configured);
    state.appliedThinkingLevel = pi.getThinkingLevel();
  }
  function captureManualThinkingLevel() {
    if (!state.appliedThinkingLevel) return;
    const current = pi.getThinkingLevel();
    if (current === state.appliedThinkingLevel) return;
    state = {
      ...state,
      manualThinkingLevel: current,
      previousThinkingLevel: void 0,
      appliedThinkingLevel: void 0
    };
  }
  function restoreThinkingLevel() {
    captureManualThinkingLevel();
    const { appliedThinkingLevel, previousThinkingLevel } = state;
    if (appliedThinkingLevel && previousThinkingLevel && pi.getThinkingLevel() === appliedThinkingLevel) {
      setPlanThinkingLevel(pi, previousThinkingLevel);
    }
    state = { ...state, appliedThinkingLevel: void 0, previousThinkingLevel: void 0 };
  }
  function deactivatePlanModeQuestionTool() {
    const activeTools = safeGetActiveTools();
    const filteredTools = withoutRequiredPlanModeTools(activeTools);
    if (filteredTools.length !== activeTools.length) {
      pi.setActiveTools(filteredTools);
    }
  }
  function safeGetActiveTools() {
    try {
      return pi.getActiveTools();
    } catch {
      return DEFAULT_TOOLS;
    }
  }
  function restoreState(ctx) {
    state = restorePlanModeState(ctx.sessionManager.getBranch(), STATE_ENTRY_TYPE);
  }
  function updateUi(ctx) {
    updatePlanModeUi(ctx, state, formatToolSummary);
  }
  function clearUi(ctx) {
    clearPlanModeUi(ctx);
  }
  function planStatusText() {
    return planModeStatusText(state, formatToolSummary);
  }
  function implementationOutcome() {
    return implementationRetentionPreview(configuredImplementationPlanRetention(settings));
  }
  function formatToolSummary() {
    const names = planModeToolNames();
    return `Tools: ${names.length > 0 ? names.join(", ") : "none"}`;
  }
  function toolByName(toolName) {
    return safeGetAllTools().find((candidate) => candidate.name === toolName);
  }
}
export {
  planMode as default
};
