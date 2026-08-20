import assert from "node:assert/strict";
import test from "node:test";

import { visibleWidth } from "@earendil-works/pi-tui";

import {
	renderRawAssistant,
	resolveRawModeArgument,
	wrapRawText,
} from "../extensions/raw-renderer.ts";
import { assistantMessage } from "./helpers.ts";

test("resolves toggle, on, off, and invalid command arguments", () => {
	assert.deepEqual(resolveRawModeArgument("", false), { enabled: true });
	assert.deepEqual(resolveRawModeArgument("  ON ", false), { enabled: true });
	assert.deepEqual(resolveRawModeArgument("off", true), { enabled: false });
	assert.deepEqual(resolveRawModeArgument("maybe", false), {
		error: "Usage: /raw [on|off]",
	});
});

test("renders Markdown source literally without adding padding or ANSI", () => {
	const message = assistantMessage([
		{
			type: "text",
			text: "# Heading\n\n**bold** and `code`\n\n```ts\nconst x = 1;\n```",
		},
	]);

	assert.deepEqual(renderRawAssistant(message, 80), [
		"# Heading",
		"",
		"**bold** and `code`",
		"",
		"```ts",
		"const x = 1;",
		"```",
	]);
});

test("preserves model-authored whitespace but strips terminal controls", () => {
	const lines = wrapRawText("  authored indent\nred\u001b[31m text\u001b[0m  ", 80);
	assert.deepEqual(lines, ["  authored indent", "red text  "]);
});

test("wraps by terminal columns without splitting wide graphemes", () => {
	assert.deepEqual(wrapRawText("ab界cd", 4), ["ab界", "cd"]);
	assert.deepEqual(wrapRawText("界", 1), ["?"]);

	for (const width of [1, 2, 3, 8]) {
		for (const line of wrapRawText("a界🙂é long", width)) {
			assert.ok(visibleWidth(line) <= width, `${JSON.stringify(line)} exceeds ${width}`);
		}
	}
});

test("removes terminal escape and control sequences", () => {
	const lines = wrapRawText(
		"safe\u0007bell\u0008back\u001b[2Acursor\u001bPpayload\u001b\\end\u0085c1",
		80,
	);
	assert.equal(lines.join("\n").includes("safe"), true);
	assert.doesNotMatch(lines.join("\n"), /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/);
});

test("handles large unbroken lines in a single grapheme pass", () => {
	const lines = wrapRawText("x".repeat(50_000), 100);
	assert.equal(lines.length, 500);
	assert.equal(lines.every((line) => line.length === 100), true);
});

test("hides thinking and omits tool calls from raw assistant prose", () => {
	const message = assistantMessage([
		{ type: "thinking", thinking: "private reasoning" },
		{ type: "text", text: "Visible answer" },
		{ type: "toolCall", id: "1", name: "read", arguments: { path: "x" } },
	]);
	assert.deepEqual(renderRawAssistant(message, 80), ["Visible answer"]);
});

test("renders stop notices as plain text", () => {
	const truncated = assistantMessage([{ type: "text", text: "Partial" }], {
		stopReason: "length",
	});
	assert.deepEqual(renderRawAssistant(truncated, 80), [
		"Partial",
		"Response was truncated before completion.",
	]);

	const failed = assistantMessage([], {
		stopReason: "error",
		errorMessage: "network failed",
	});
	assert.deepEqual(renderRawAssistant(failed, 80), ["Error: network failed"]);
});
