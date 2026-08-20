import assert from "node:assert/strict";
import test from "node:test";

import {
	AssistantMessageComponent,
	initTheme,
} from "@earendil-works/pi-coding-agent";

import { installRawModePatch } from "../extensions/patch.ts";
import { assistantMessage } from "./helpers.ts";

initTheme("dark", false);

test("patch toggles raw rendering and restores Pi's renderer", () => {
	const prototype = AssistantMessageComponent.prototype;
	const originalRender = prototype.render;
	const originalUpdateContent = prototype.updateContent;
	const controller = installRawModePatch(true);

	try {
		assert.equal(controller.compatible, true);
		const component = new AssistantMessageComponent(
			assistantMessage([{ type: "text", text: "# Heading\n\n**bold**" }]),
		);
		assert.deepEqual(component.render(40), ["# Heading", "", "**bold**"]);
		component.updateContent(
			assistantMessage([{ type: "text", text: "Streaming **update**" }]),
			true,
		);
		assert.deepEqual(component.render(40), ["Streaming **update**"]);

		controller.setEnabled(false);
		assert.notDeepEqual(component.render(40), ["Streaming **update**"]);
	} finally {
		controller.dispose();
	}

	assert.equal(prototype.render, originalRender);
	assert.equal(prototype.updateContent, originalUpdateContent);
});

test("coexists with a renderer installed before raw mode", () => {
	const prototype = AssistantMessageComponent.prototype;
	const originalRender = prototype.render;
	function outerRender(this: AssistantMessageComponent, width: number): string[] {
		return originalRender.call(this, width);
	}
	prototype.render = outerRender;
	const controller = installRawModePatch(true);

	try {
		const component = new AssistantMessageComponent(
			assistantMessage([{ type: "text", text: "**literal**" }]),
		);
		assert.deepEqual(component.render(40), ["**literal**"]);
	} finally {
		controller.dispose();
		assert.equal(prototype.render, outerRender);
		prototype.render = originalRender;
	}
});

test("restores methods independently when a later renderer remains", () => {
	const prototype = AssistantMessageComponent.prototype;
	const originalRender = prototype.render;
	const originalUpdateContent = prototype.updateContent;
	const controller = installRawModePatch(true);
	const rawRender = prototype.render;
	function laterRender(this: AssistantMessageComponent, width: number): string[] {
		return rawRender.call(this, width);
	}
	prototype.render = laterRender;

	controller.dispose();
	assert.equal(prototype.render, laterRender);
	assert.equal(prototype.updateContent, originalUpdateContent);

	prototype.render = originalRender;
	delete (prototype as unknown as Record<symbol, unknown>)[
		Symbol.for("pi-raw-mode.assistant-renderer-patch.v1")
	];
});

test("duplicate installs share one patch until the last owner disposes", () => {
	const prototype = AssistantMessageComponent.prototype;
	const originalRender = prototype.render;
	const first = installRawModePatch(false);
	const patchedRender = prototype.render;
	const second = installRawModePatch(true);

	assert.equal(prototype.render, patchedRender);
	assert.equal(first.isEnabled(), true);
	first.dispose();
	assert.equal(prototype.render, patchedRender);
	second.dispose();
	assert.equal(prototype.render, originalRender);
});
