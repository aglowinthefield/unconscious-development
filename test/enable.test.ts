import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const cli = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "unconscious");

// A home with fake harness CLIs on PATH, so enable sees only the harnesses the test names.
function run(harnesses: string[]) {
  const home = mkdtempSync(join(tmpdir(), "ud-enable-"));
  const bin = join(home, "bin");
  mkdirSync(bin);
  for (const h of harnesses) {
    writeFileSync(join(bin, h), "#!/bin/sh\n");
    chmodSync(join(bin, h), 0o755);
  }
  const env = {
    HOME: home,
    PATH: [bin, dirname(process.execPath), "/usr/bin", "/bin"].join(":"),
    NO_COLOR: "1",
  };
  const ud = (...args: string[]) => execFileSync(cli, args, { env, encoding: "utf8", stdio: "pipe" });
  const pi = () => existsSync(join(home, ".pi/agent/agents/unconscious/shadow.md"));
  const claude = () => existsSync(join(home, ".claude/agents/shadow.md"));
  return { ud, pi, claude };
}

test("enable installs into every harness on PATH", () => {
  const both = run(["pi", "claude"]);
  both.ud("enable");
  assert.deepEqual([both.pi(), both.claude()], [true, true]);

  const claudeOnly = run(["claude"]);
  claudeOnly.ud("enable");
  assert.deepEqual([claudeOnly.pi(), claudeOnly.claude()], [false, true]);
});

test("enable falls back to pi when no harness is on PATH, and --harness picks one", () => {
  const none = run([]);
  none.ud("enable");
  assert.deepEqual([none.pi(), none.claude()], [true, false]);

  const picked = run(["pi", "claude"]);
  picked.ud("enable", "--harness", "claude");
  assert.deepEqual([picked.pi(), picked.claude()], [false, true]);
});

test("disable removes the cast from both harnesses, and works where only one was set up", () => {
  const h = run(["pi", "claude"]);
  h.ud("enable");
  h.ud("disable");
  assert.deepEqual([h.pi(), h.claude()], [false, false]);

  const claudeOnly = run(["claude"]);
  claudeOnly.ud("enable");
  claudeOnly.ud("disable");
  assert.deepEqual([claudeOnly.pi(), claudeOnly.claude()], [false, false]);
});
