import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const agentDir = mkdtempSync(join(tmpdir(), "pi-raw-mode-"));
const executable = join(
	root,
	"node_modules",
	".bin",
	process.platform === "win32" ? "pi.cmd" : "pi",
);

try {
	const result = spawnSync(executable, ["-e", root, "--list-models"], {
		cwd: root,
		encoding: "utf8",
		env: { ...process.env, PI_CODING_AGENT_DIR: agentDir },
	});
	assert.equal(
		result.status,
		0,
		`Pi package smoke test failed:\n${result.stdout}\n${result.stderr}`,
	);
	console.log("Pi package smoke test passed");
} finally {
	rmSync(agentDir, { recursive: true, force: true });
}
