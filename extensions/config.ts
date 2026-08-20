import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getAgentDir } from "@earendil-works/pi-coding-agent";
import type { KeyId } from "@earendil-works/pi-tui";

export const DEFAULT_SHORTCUT: KeyId = "alt+r";
export const CONFIG_FILENAME = "pi-raw-mode.json";

const modifiers = ["ctrl", "shift", "alt", "super"] as const;
const namedKeys = new Set([
	"escape",
	"esc",
	"enter",
	"return",
	"tab",
	"space",
	"backspace",
	"delete",
	"insert",
	"clear",
	"home",
	"end",
	"pageUp",
	"pageDown",
	"up",
	"down",
	"left",
	"right",
]);
const symbolKeys = new Set("`-=[]\\;',./!@#$%^&*()_+|~{}:<>?".split(""));

export interface LoadedRawModeConfig {
	path: string;
	shortcut: KeyId | null;
	warning?: string;
}

export function isValidShortcut(value: string): value is KeyId {
	let key = value;
	const seen = new Set<string>();
	let consumedModifier = true;

	while (consumedModifier) {
		consumedModifier = false;
		for (const modifier of modifiers) {
			const prefix = `${modifier}+`;
			if (!key.startsWith(prefix)) continue;
			if (seen.has(modifier)) return false;
			seen.add(modifier);
			key = key.slice(prefix.length);
			consumedModifier = true;
			break;
		}
	}

	return (
		/^[a-z0-9]$/.test(key) ||
		/^f(?:[1-9]|1[0-2])$/.test(key) ||
		namedKeys.has(key) ||
		symbolKeys.has(key)
	);
}

export function loadRawModeConfig(agentDir = getAgentDir()): LoadedRawModeConfig {
	const path = join(agentDir, CONFIG_FILENAME);
	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(path, "utf8"));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return { path, shortcut: DEFAULT_SHORTCUT };
		}
		return {
			path,
			shortcut: DEFAULT_SHORTCUT,
			warning: `Could not read ${path}; using ${DEFAULT_SHORTCUT}.`,
		};
	}

	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		return {
			path,
			shortcut: DEFAULT_SHORTCUT,
			warning: `Invalid config in ${path}; using ${DEFAULT_SHORTCUT}.`,
		};
	}

	const shortcut = (parsed as { shortcut?: unknown }).shortcut;
	if (shortcut === undefined) return { path, shortcut: DEFAULT_SHORTCUT };
	if (shortcut === null) return { path, shortcut: null };
	if (typeof shortcut === "string" && isValidShortcut(shortcut)) {
		return { path, shortcut };
	}
	return {
		path,
		shortcut: DEFAULT_SHORTCUT,
		warning: `Invalid shortcut in ${path}; using ${DEFAULT_SHORTCUT}.`,
	};
}
