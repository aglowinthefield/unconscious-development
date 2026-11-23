// `unconscious status`: what `enable` installed for each harness, and which `schedule` jobs are on.
// The paths and env overrides match bin/unconscious, which writes them.

import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { c, no, pad, yes } from "./style.ts";

const CLAUDE_MARK = "<!-- written by unconscious enable --harness claude; disable removes it -->";
export const JOBS = [
  ["status-page", "every 15 minutes"],
  ["questions", `every ${process.env.UD_QUESTIONS_INTERVAL ?? 120} seconds`],
  ["propose", `daily at ${(process.env.UD_PROPOSE_HOUR ?? "7").padStart(2, "0")}:00`],
  ["mirror", "every 15 minutes"],
] as const;

const paths = (udRoot: string, env = process.env, home = env.HOME ?? homedir()) => ({
  skills: join(udRoot, "skills"),
  piAgents: join(env.PI_AGENTS_DIR ?? join(home, ".pi/agent/agents"), "unconscious"),
  piSkills: env.UD_SKILLS_DIR ?? join(home, ".agents/skills"),
  piPrompts: env.PI_PROMPTS_DIR ?? join(home, ".pi/agent/prompts"),
  piSettings: env.PI_SETTINGS ?? join(home, ".pi/agent/settings.json"),
  bili: env.BILI_CONFIG ?? join(home, ".config/billion-context/billion-context.json"),
  claudeAgents: env.CLAUDE_AGENTS_DIR ?? join(home, ".claude/agents"),
  claudeSkills: env.CLAUDE_SKILLS_DIR ?? join(home, ".claude/skills"),
  launchAgents: join(home, "Library/LaunchAgents"),
  systemdUser: join(env.XDG_CONFIG_HOME ?? join(home, ".config"), "systemd/user"),
});

const readJson = (p: string): any => {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return {};
  }
};
const ls = (dir: string) => {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
};
const linkOf = (p: string) => {
  try {
    return lstatSync(p).isSymbolicLink() ? readlinkSync(p) : undefined;
  } catch {
    return undefined;
  }
};

// Skills linked from another checkout of Unconscious Development (the main one, when this is a
// worktree) still count; `from` names that checkout.
function linkedSkills(names: string[], dir: string, udRoot: string): { skills: string[]; from?: string } {
  const skills: string[] = [];
  let from: string | undefined;
  for (const s of names) {
    const target = linkOf(join(dir, s));
    if (!target) continue;
    skills.push(s);
    const root = dirname(dirname(target));
    if (root !== udRoot) from = root;
  }
  return { skills, from };
}

// When a job runs, from its plist, so a changed interval shows as it was turned on.
function when(plist: string, fallback: string): string {
  const text = readFileSync(plist, "utf8");
  const every = text.match(/<key>StartInterval<\/key>\s*<integer>(\d+)</);
  if (every) {
    const n = Number(every[1]);
    return n % 60 ? `every ${n} seconds` : `every ${n / 60} minute${n === 60 ? "" : "s"}`;
  }
  const hour = text.match(/<key>Hour<\/key>\s*<integer>(\d+)</);
  return hour ? `daily at ${hour[1].padStart(2, "0")}:00` : fallback;
}

// The same, from a systemd timer (Linux).
function whenTimer(timer: string, fallback: string): string {
  const text = readFileSync(timer, "utf8");
  const every = text.match(/^OnUnitActiveSec=(\d+)$/m);
  if (every) {
    const n = Number(every[1]);
    return n % 60 ? `every ${n} seconds` : `every ${n / 60} minute${n === 60 ? "" : "s"}`;
  }
  const hour = text.match(/^OnCalendar=\S+ (\d+):/m);
  return hour ? `daily at ${hour[1]}:00` : fallback;
}

export interface SetupStatus {
  pi: {
    roles: string[];
    skills: string[];
    prompts: string[];
    from?: string;
    installed: boolean;
    builtinsHidden: boolean;
    acpOff: boolean;
  };
  claude: { roles: string[]; skills: string[]; from?: string };
  jobs: { name: string; when: string; on: boolean; log: string }[];
}

export function setupStatus(udRoot: string): SetupStatus {
  const p = paths(udRoot);
  const ours = ls(p.skills).filter((s) => !s.startsWith("."));
  const settings = readJson(p.piSettings),
    bili = readJson(p.bili);
  return {
    pi: {
      roles: ls(p.piAgents)
        .filter((f) => f.endsWith(".md"))
        .map((f) => basename(f, ".md")),
      ...linkedSkills(ours, p.piSkills, udRoot),
      prompts: ls(join(udRoot, "prompts"))
        .filter((f) => f.endsWith(".md") && linkOf(join(p.piPrompts, f)))
        .map((f) => `/${basename(f, ".md")}`),
      installed: (settings.packages ?? []).some((x: unknown) => JSON.stringify(x).includes("pi-subagents")),
      builtinsHidden: settings.subagents?.disableBuiltins === true,
      acpOff: bili.pi?.subagents === false,
    },
    claude: {
      roles: ls(p.claudeAgents)
        .filter((f) => f.endsWith(".md") && readFileSync(join(p.claudeAgents, f), "utf8").includes(CLAUDE_MARK))
        .map((f) => basename(f, ".md")),
      ...linkedSkills(ours, p.claudeSkills, udRoot),
    },
    jobs: JOBS.map(([name, fallback]) => {
      const timer = join(p.systemdUser, `unconscious-${name}.timer`);
      if (existsSync(timer))
        return { name, on: true, when: whenTimer(timer, fallback), log: `journalctl --user -u unconscious-${name}` };
      const plist = join(p.launchAgents, `dev.unconscious.${name}.plist`);
      const on = existsSync(plist);
      return { name, on, when: on ? when(plist, fallback) : fallback, log: `~/Library/Logs/unconscious-${name}.log` };
    }),
  };
}

export function formatStatus(s: SetupStatus): string {
  const out: string[] = [];
  const line = (ok: boolean, label: string, value = "") =>
    out.push(`  ${(ok ? yes : no)(pad(label, 24))}${value}`.trimEnd());
  const hint = (cmd: string) => out.push(`  ${c.dim("→")} ${c.cmd(cmd)}`);
  const list = (xs: string[]) => (xs.length ? xs.join(" ") : c.dim("none"));

  out.push(c.head("pi"));
  const piOn = s.pi.roles.length > 0;
  line(piOn, "roles", list(s.pi.roles));
  line(s.pi.skills.length > 0, "skills", list(s.pi.skills));
  if (s.pi.from) out.push(`  ${c.dim(`  linked from ${s.pi.from}`)}`);
  line(s.pi.prompts.length > 0, "prompts", list(s.pi.prompts));
  line(s.pi.installed, "pi-subagents installed", s.pi.installed ? "" : c.dim("the roles need it to run"));
  if (piOn) {
    line(s.pi.builtinsHidden, "builtin agents hidden");
    line(s.pi.acpOff, "acp_delegate off", s.pi.acpOff ? "" : c.dim("billion-context will compete with the roles"));
  } else hint("unconscious enable");

  out.push("", c.head("Claude Code"));
  line(s.claude.roles.length > 0, "roles", list(s.claude.roles));
  line(s.claude.skills.length > 0, "skills", list(s.claude.skills));
  if (s.claude.from) out.push(`  ${c.dim(`  linked from ${s.claude.from}`)}`);
  if (!s.claude.roles.length) hint("unconscious enable --harness claude");

  out.push("", c.head("Schedule"));
  const w = Math.max(...s.jobs.map((j) => j.when.length)) + 2;
  for (const j of s.jobs) line(j.on, j.name, j.on ? `${pad(j.when, w)}${c.dim(j.log)}` : c.dim(j.when));
  if (!s.jobs.some((j) => j.on)) hint("unconscious schedule on");
  return out.join("\n");
}
