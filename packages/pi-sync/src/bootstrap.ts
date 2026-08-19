import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { installDeferred } from "./lazy-extension.js";

export default function (pi: ExtensionAPI) {
	installDeferred(pi, () => import("./index.js"), {
		commands: [{ name: "sync", description: "Snapshot and restore the working tree" }],
	});
}
