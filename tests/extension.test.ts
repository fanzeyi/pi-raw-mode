import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
	AssistantMessageComponent,
	initTheme,
	type ExtensionAPI,
	type ExtensionCommandContext,
	type ExtensionContext,
} from "@earendil-works/pi-coding-agent";

import rawModeExtension from "../extensions/index.ts";
import { assistantMessage } from "./helpers.ts";

initTheme("dark", false);

test("registers Codex-style command and shortcut controls", async (context) => {
	const agentDir = mkdtempSync(join(tmpdir(), "pi-raw-mode-extension-"));
	const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
	process.env.PI_CODING_AGENT_DIR = agentDir;
	writeFileSync(
		join(agentDir, "pi-raw-mode.json"),
		JSON.stringify({ shortcut: "ctrl+shift+r" }),
	);
	context.after(() => {
		rmSync(agentDir, { recursive: true, force: true });
		if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
		else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
	});

	const originalRender = AssistantMessageComponent.prototype.render;
	const commands = new Map<string, { handler: (args: string, ctx: ExtensionCommandContext) => Promise<void> }>();
	const shortcuts = new Map<string, { handler: (ctx: ExtensionContext) => Promise<void> }>();
	const events = new Map<string, (...args: unknown[]) => unknown>();
	const pi = {
		registerCommand: (name: string, definition: unknown) => {
			commands.set(name, definition as (typeof commands extends Map<string, infer V> ? V : never));
		},
		registerShortcut: (name: string, definition: unknown) => {
			shortcuts.set(name, definition as (typeof shortcuts extends Map<string, infer V> ? V : never));
		},
		on: (name: string, handler: (...args: unknown[]) => unknown) => {
			events.set(name, handler);
		},
	} as unknown as ExtensionAPI;

	rawModeExtension(pi);
	assert.equal(AssistantMessageComponent.prototype.render, originalRender);
	const notices: Array<[string, string]> = [];
	const statuses: Array<[string, string | undefined]> = [];
	const ctx = {
		mode: "tui",
		ui: {
			theme: { fg: (_color: string, text: string) => text },
			notify: (message: string, level: string) => notices.push([message, level]),
			setStatus: (id: string, value: string | undefined) => statuses.push([id, value]),
		},
	} as unknown as ExtensionCommandContext;

	const raw = commands.get("raw");
	const configuredShortcut = shortcuts.get("ctrl+shift+r");
	assert.ok(raw);
	assert.ok(configuredShortcut);
	await events.get("session_start")?.({ reason: "startup" }, ctx);
	assert.notEqual(AssistantMessageComponent.prototype.render, originalRender);

	await raw.handler("on", ctx);
	assert.deepEqual(notices.at(-1), ["Raw mode on.", "info"]);
	assert.deepEqual(statuses.at(-1), ["pi-raw-mode", "raw"]);

	const component = new AssistantMessageComponent(
		assistantMessage([{ type: "text", text: "# Literal" }]),
	);
	assert.deepEqual(component.render(40), ["# Literal"]);

	const noticeCount = notices.length;
	await configuredShortcut.handler(ctx);
	assert.equal(notices.length, noticeCount);
	assert.deepEqual(statuses.at(-1), ["pi-raw-mode", undefined]);

	await events.get("session_shutdown")?.();
	assert.equal(AssistantMessageComponent.prototype.render, originalRender);
	delete (globalThis as Record<symbol, unknown>)[Symbol.for("pi-raw-mode.preference.v1")];
});
