import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatStatus, setupStatus } from "../src/setup-status.ts";

const udRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function withHome(fn: (home: string) => void) {
  const home = mkdtempSync(join(tmpdir(), "ud-status-"));
  const saved = { ...process.env };
  for (const k of ["PI_AGENTS_DIR", "UD_SKILLS_DIR", "PI_SETTINGS", "BILI_CONFIG", "CLAUDE_AGENTS_DIR", "CLAUDE_SKILLS_DIR", "PI_PROMPTS_DIR", "XDG_CONFIG_HOME"]) delete process.env[k];
  process.env.HOME = home;
  process.env.NO_COLOR = "1";
  try { fn(home); } finally { process.env = saved; }
}

test("status says nothing is on in a fresh home, and how to turn it on", () => withHome(() => {
  const s = setupStatus(udRoot);
  assert.deepEqual([s.pi.roles, s.pi.skills, s.claude.roles], [[], [], []]);
  assert.ok(s.jobs.every(j => !j.on));
  const text = formatStatus(s);
  for (const hint of ["unconscious enable", "unconscious enable --harness claude", "unconscious schedule on"]) assert.ok(text.includes(`→ ${hint}\n`) || text.endsWith(`→ ${hint}`), hint);
}));

test("status reads what enable and schedule wrote", () => withHome(home => {
  mkdirSync(join(home, ".pi/agent/agents/unconscious"), { recursive: true });
  symlinkSync(join(udRoot, "docs/roles/ruler.md"), join(home, ".pi/agent/agents/unconscious/ruler.md"));
  mkdirSync(join(home, ".agents/skills"), { recursive: true });
  symlinkSync(join(udRoot, "skills/spec"), join(home, ".agents/skills/spec"));
  symlinkSync("/elsewhere/ud/skills/propose", join(home, ".agents/skills/propose"));
  writeFileSync(join(home, ".pi/agent/settings.json"), JSON.stringify({ packages: ["npm:pi-subagents"], subagents: { disableBuiltins: true } }));
  mkdirSync(join(home, "Library/LaunchAgents"), { recursive: true });
  writeFileSync(join(home, "Library/LaunchAgents/dev.unconscious.questions.plist"), "<key>StartInterval</key><integer>300</integer>");
  mkdirSync(join(home, ".config/systemd/user"), { recursive: true });
  writeFileSync(join(home, ".config/systemd/user/unconscious-propose.timer"), "[Timer]\nOnCalendar=*-*-* 06:00:00\nPersistent=true\n");
  const s = setupStatus(udRoot);
  assert.deepEqual(s.pi.roles, ["ruler"]);
  assert.deepEqual(s.pi.skills.sort(), ["propose", "spec"]);
  assert.equal(s.pi.from, "/elsewhere/ud");
  assert.ok(s.pi.installed && s.pi.builtinsHidden && !s.pi.acpOff);
  assert.deepEqual(s.jobs.filter(j => j.on).map(j => [j.name, j.when]), [["questions", "every 5 minutes"], ["propose", "daily at 06:00"]]);
  assert.match(formatStatus(s), /✗ acp_delegate off/);
}));
