import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { installDeferred } from "./lazy-extension.js";

export default function (pi: ExtensionAPI) {
	pi.registerFlag("plan", {
		description: "Start in Codex-like Plan mode",
		type: "boolean",
		default: false,
	});
	installDeferred(pi, () => import("./index.js"), {
		commands: [{ name: "plan", description: "Enter or manage Codex-like Plan mode" }],
	});
}
