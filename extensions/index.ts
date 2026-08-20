import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";

import { loadRawModeConfig } from "./config.ts";
import {
	installRawModePatch,
	type RawModePatchController,
} from "./patch.ts";
import { resolveRawModeArgument } from "./raw-renderer.ts";

const STATUS_ID = "pi-raw-mode";
const PREFERENCE_SYMBOL = Symbol.for("pi-raw-mode.preference.v1");

interface Preference {
	enabled: boolean;
}

function envDefault(): boolean {
	return /^(1|on|true|yes)$/i.test(process.env.PI_RAW_MODE ?? "");
}

function preference(): Preference {
	const globals = globalThis as typeof globalThis & {
		[PREFERENCE_SYMBOL]?: Preference;
	};
	return (globals[PREFERENCE_SYMBOL] ??= { enabled: envDefault() });
}

export default function rawModeExtension(pi: ExtensionAPI) {
	const preferred = preference();
	const config = loadRawModeConfig();
	let patch: RawModePatchController | undefined;

	function updateUi(ctx: ExtensionContext, notify: boolean): void {
		patch?.setEnabled(preferred.enabled);
		ctx.ui.setStatus(
			STATUS_ID,
			preferred.enabled ? ctx.ui.theme.fg("accent", "raw") : undefined,
		);
		if (notify) {
			ctx.ui.notify(`Raw mode ${preferred.enabled ? "on" : "off"}.`, "info");
		}
	}

	function toggle(ctx: ExtensionContext, notify: boolean): void {
		preferred.enabled = !preferred.enabled;
		updateUi(ctx, notify);
	}

	pi.registerCommand("raw", {
		description: "Toggle literal, zero-padding assistant output",
		getArgumentCompletions: (prefix) => {
			const choices = ["on", "off"]
				.filter((value) => value.startsWith(prefix))
				.map((value) => ({ value, label: value }));
			return choices.length > 0 ? choices : null;
		},
		handler: async (args, ctx) => {
			if (ctx.mode !== "tui") {
				ctx.ui.notify("Raw mode is only available in the interactive TUI.", "warning");
				return;
			}
			if (!patch?.compatible) {
				ctx.ui.notify(
					`Raw mode is unavailable: ${patch?.incompatibilityReason ?? "no active TUI session"}`,
					"error",
				);
				return;
			}

			const result = resolveRawModeArgument(args, preferred.enabled);
			if (result.error) {
				ctx.ui.notify(result.error, "warning");
				return;
			}
			preferred.enabled = result.enabled ?? preferred.enabled;
			updateUi(ctx, true);
		},
	});

	if (config.shortcut) {
		pi.registerShortcut(config.shortcut, {
			description: "Toggle raw assistant output",
			handler: async (ctx) => {
				if (ctx.mode === "tui" && patch?.compatible) toggle(ctx, false);
			},
		});
	}

	pi.on("session_start", (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		if (config.warning) ctx.ui.notify(config.warning, "warning");
		patch?.dispose();
		patch = installRawModePatch(preferred.enabled);
		if (!patch.compatible) {
			ctx.ui.notify(
				`pi-raw-mode disabled: ${patch.incompatibilityReason}`,
				"warning",
			);
			return;
		}
		updateUi(ctx, false);
	});

	pi.on("session_shutdown", () => {
		patch?.dispose();
		patch = undefined;
	});
}
