import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";

import {
	CONFIG_FILENAME,
	DEFAULT_SHORTCUT,
	isValidShortcut,
	loadRawModeConfig,
} from "../extensions/config.ts";

function temporaryConfigDir(context: TestContext): string {
	const directory = mkdtempSync(join(tmpdir(), "pi-raw-mode-config-"));
	context.after(() => rmSync(directory, { recursive: true, force: true }));
	return directory;
}

test("uses Alt+R when the config file is absent", (context) => {
	const config = loadRawModeConfig(temporaryConfigDir(context));
	assert.equal(config.shortcut, DEFAULT_SHORTCUT);
	assert.equal(config.warning, undefined);
});

test("loads a custom shortcut and supports disabling it", (context) => {
	const directory = temporaryConfigDir(context);
	const path = join(directory, CONFIG_FILENAME);
	writeFileSync(path, JSON.stringify({ shortcut: "ctrl+shift+r" }));
	assert.equal(loadRawModeConfig(directory).shortcut, "ctrl+shift+r");

	writeFileSync(path, JSON.stringify({ shortcut: null }));
	assert.equal(loadRawModeConfig(directory).shortcut, null);
});

test("falls back safely for malformed configuration", (context) => {
	const directory = temporaryConfigDir(context);
	const path = join(directory, CONFIG_FILENAME);
	writeFileSync(path, "not json");
	const malformed = loadRawModeConfig(directory);
	assert.equal(malformed.shortcut, DEFAULT_SHORTCUT);
	assert.match(malformed.warning ?? "", /Could not read/);

	writeFileSync(path, JSON.stringify({ shortcut: "ctrl+not-a-key" }));
	const invalid = loadRawModeConfig(directory);
	assert.equal(invalid.shortcut, DEFAULT_SHORTCUT);
	assert.match(invalid.warning ?? "", /Invalid shortcut/);
});

test("validates Pi shortcut syntax", () => {
	for (const shortcut of ["alt+r", "ctrl+shift+r", "super+k", "ctrl++", "f12"]) {
		assert.equal(isValidShortcut(shortcut), true, shortcut);
	}
	for (const shortcut of ["", "ctrl+", "ctrl+ctrl+r", "ctrl+f13", "cmd+r"]) {
		assert.equal(isValidShortcut(shortcut), false, shortcut);
	}
});
