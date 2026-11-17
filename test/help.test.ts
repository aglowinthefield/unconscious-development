import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { COMMANDS, ENV, commandHelp, overview, suggest } from "../src/help.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("every command the CLI runs has help, and nothing else does", () => {
  const cli = readFileSync(join(root, "src/cli.ts"), "utf8");
  const bash = readFileSync(join(root, "bin/unconscious"), "utf8");
  const handled = new Set([
    ...[...cli.matchAll(/command === "([a-z][a-z-]*)"/g)].map(m => m[1]),
    ...[...bash.slice(bash.lastIndexOf('case "$1" in')).matchAll(/^  ([a-z-]+)\)/gm)].map(m => m[1]),
  ]);
  handled.delete("help");
  assert.deepEqual([...handled].sort(), COMMANDS.map(c => c.name).sort());
});

test("help names only environment variables it describes", () => {
  for (const c of COMMANDS) for (const e of c.env ?? []) assert.ok(ENV[e], `${c.name}: ${e}`);
});

test("help renders without colour off a terminal", () => {
  assert.doesNotMatch(overview(), /\x1b\[/);
  for (const c of COMMANDS) assert.match(commandHelp(c.name)!, new RegExp(`unconscious ${c.name}`));
});

test("a typo suggests the nearest command", () => {
  assert.equal(suggest("reveiw"), "review");
  assert.equal(suggest("checkspec"), "check-spec");
  assert.equal(suggest("zzzzzzzz"), undefined);
});
