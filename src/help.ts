import { c, columns, pad, paint } from "./style.ts";

// Every command `unconscious` knows, and the help it prints. Adding a command means adding an entry
// here; the bash entry point and src/cli.ts route `help`, `-h` and unknown commands through it.

export type Command = {
  name: string;
  group: Group;
  args?: string;
  summary: string;
  usage?: string[]; // extra forms, after `unconscious <name> <args>`
  details?: string;
  options?: [flag: string, what: string][];
  examples?: [cmd: string, what: string][];
  env?: string[]; // names from ENV this command reads
};

export const GROUPS = ["Set up", "Specs and tasks", "Cast on demand", "Now pages"] as const;
type Group = (typeof GROUPS)[number];

const ROOT_REPO: [string, string][] = [
  ["--root DIR", "the project repo (default: the current directory)"],
  ["--repo OWNER/NAME", "the GitHub repo (default: from the origin remote)"],
];

export const COMMANDS: Command[] = [
  {
    name: "init", group: "Set up", args: "[--domain NAME]",
    summary: "set a repo up: docs, CI workflows, a Persona",
    details: "Run it from your project's repo. Creates docs/specs/, a draft Persona for the domain, and the CI workflows pinned to this checkout's commit. It never overwrites a file.\nOn a terminal with no --domain, it asks for the domain and its owner, lists the files, and asks before writing them.",
    options: [["--domain NAME", "draft docs/personas/NAME.md, and ask nothing"], ["-y, --yes", "ask nothing"], ["--root DIR", "the project repo (default: the current directory)"], ["--dry-run", "say what it would create, write nothing"]],
    examples: [["unconscious init", "answer a few questions"], ["unconscious init --domain billing", "set up a repo whose first domain is billing"]],
  },
  {
    name: "enable", group: "Set up", args: "[--harness pi|claude]",
    summary: "install the cast into pi or Claude Code",
    details: "pi: links docs/roles/*.md into ~/.pi/agent/agents/unconscious and skills/* into ~/.agents/skills, hides pi-subagents' builtin presets and turns off billion-context's acp_delegate.\nclaude: writes the roles into ~/.claude/agents and links skills/* into ~/.claude/skills.\nIt touches only what it owns, so running it twice is safe. Changes apply to new sessions.",
    options: [["--harness pi|claude", "which harness to install into (default: pi)"]],
    examples: [["unconscious enable", "install into pi"], ["unconscious enable --harness claude", "install into Claude Code"]],
  },
  {
    name: "disable", group: "Set up", args: "[--harness pi|claude]",
    summary: "remove what enable installed",
    options: [["--harness pi|claude", "which harness to remove from (default: pi)"]],
  },
  {
    name: "status", group: "Set up",
    summary: "show what's installed and scheduled",
    details: "For pi and Claude Code: which roles and skills enable installed, and for pi the settings it changed. Then which schedule jobs are on, how often they run and where they log.",
  },
  {
    name: "schedule", group: "Set up", args: "on|off",
    summary: "run the background jobs with launchd",
    details: "status-page every 15 minutes, questions every 2 minutes, propose daily at 07:00. The jobs keep the PATH, Now folder and UD_HARNESS of the shell that turned them on. With no argument, says whether it's on.",
    examples: [["unconscious schedule on", ""], ["tail -f ~/Library/Logs/unconscious-questions.log", "watch a job"]],
    env: ["UD_HARNESS", "UD_NOW_DIR", "UD_QUESTIONS_INTERVAL", "UD_PROPOSE_HOUR"],
  },
  {
    name: "check-spec", group: "Specs and tasks", args: "[FILE...]",
    summary: "check the specs and plans in docs/specs/",
    usage: ["--pr N [--repo O/R]", "--issue N [--repo O/R]"],
    details: "With --pr it also keeps one comment on the PR saying why the check fails, and rewrites it once it passes; the workflow runs it that way. With --issue it checks a trivial issue's criteria instead.",
    options: [["--pr N", "explain the result in a comment on PR N"], ["--issue N", "check issue N's criteria"], ...ROOT_REPO, ["--dry-run", "with --pr, print the comment instead of posting it"]],
    examples: [["unconscious check-spec", "check the whole repo"], ["unconscious check-spec docs/specs/billing/refunds.md", "check one spec"]],
  },
  {
    name: "spec-to-tasks", group: "Specs and tasks", args: "ISSUE",
    summary: "turn an issue's plan into tasks",
    details: "Tasks are keyed gh-N/t1, gh-N/t2… They go to Bakery when bakery-cli is on the path, else they're printed for you to start in a session. Refuses unless the issue is ready-for-agent and its spec is approved and passes check-spec.",
    options: [["--runner bakery|session", "where tasks go (default: bakery if installed)"], ["--board ID", "the Bakery board"], ...ROOT_REPO, ["--dry-run", "show the tasks, skip the state checks"]],
    examples: [["unconscious spec-to-tasks 42 --dry-run", "preview issue 42's tasks"]],
  },
  {
    name: "on-merge", group: "Specs and tasks", args: "--base SHA",
    usage: ["--base SHA --head SHA"],
    summary: "after a spec merges, start its issue's tasks",
    details: "The CI workflow runs it on every push to main. Each approved spec the merge touched moves its plan's issue to ready-for-agent, then runs spec-to-tasks on it.",
    options: [["--base SHA", "the commit before the merge"], ["--head SHA", "the merge (default: HEAD)"], ["--runner bakery|session", ""], ["--board ID", ""], ...ROOT_REPO],
  },
  {
    name: "task-merged", group: "Specs and tasks", args: "--pr N",
    summary: "after a task merges, close out its issue",
    details: "When every task of the issue has a merged PR, sets the spec to built, removes its plan, and closes the issue, or moves it to verifying when the spec has after-deploy criteria. Pushes the spec change to the base branch, or opens a PR when the branch refuses.",
    options: [["--pr N", "the task PR that merged"], ["--branch B", "where the spec change goes (default: the current branch)"], ...ROOT_REPO, ["--dry-run", "say what it would do"]],
  },
  {
    name: "draft", group: "Cast on demand", args: "ISSUE",
    summary: "the Ruler drafts a small issue's criteria",
    details: "Runs headless. A trivial issue gets its criteria in its body and a comment asking for ready-for-agent. A bigger one gets a comment saying it needs a spec session. Changes no files.",
    examples: [["unconscious draft 42", ""]],
    env: ["UD_HARNESS"],
  },
  {
    name: "review", group: "Cast on demand", args: "PR [--comment]",
    summary: "the Shadow reviews a PR against its criteria",
    details: "Runs headless in a temporary worktree, against the criteria in the PR or its linked issues, or the ones the PR claims when nobody wrote any. A first try that needs no setup.",
    options: [["--comment", "post the verdicts on the PR"]],
    examples: [["unconscious review 128", "print the verdicts"], ["unconscious review 128 --comment", "and post them"]],
    env: ["UD_HARNESS"],
  },
  {
    name: "propose", group: "Cast on demand",
    summary: "the Magician proposes what to spec next",
    env: ["UD_HARNESS", "UD_NOW_DIR"],
  },
  {
    name: "status-page", group: "Now pages", args: "[PROJECT]",
    summary: "rebuild the 🌀 Now pages",
    details: "Any page with repo: in its frontmatter is a project page. Sections it doesn't write, like Proposed next, stay as they are.",
    options: [["--dir DIR", "the Now folder"]],
    env: ["UD_NOW_DIR", "DEV_VAULT"],
  },
  {
    name: "questions", group: "Now pages", args: "[PROJECT]",
    summary: "ask spec PRs' open questions, apply replies",
    usage: ["--pr N [--repo O/R]"],
    details: "Posts each open marker on a spec PR as a review comment, once, and turns a reply in that thread into the text that replaces the marker, committed to the PR branch. Plain replies are read by a small model; a reply in quotes or backticks goes in as written.",
    options: [["--pr N", "only PR N"], ["--dir DIR", "the Now folder"], ["--repo O/R", ""], ["--dry-run", "say what it would post and commit"]],
    env: ["UD_SELF", "UD_INTERPRETER_MODEL", "UD_NOW_DIR"],
  },
];

export const ENV: Record<string, string> = {
  UD_HARNESS: "pi or claude: who runs the headless commands (default: pi)",
  UD_NOW_DIR: "the 🌀 Now folder (default: $DEV_VAULT/🌀 Now)",
  DEV_VAULT: "the Obsidian vault the Now folder is in",
  UD_SELF: "logins whose replies count (default: anyone with a stake in the repo)",
  UD_INTERPRETER_MODEL: "the model that reads replies to questions",
  UD_QUESTIONS_INTERVAL: "seconds between questions runs (default: 120)",
  UD_PROPOSE_HOUR: "hour propose runs at (default: 7)",
};

// The cast as a row of tarot cards, coloured night to dawn, each with its role's name below.
const CARDS: [role: string, numeral: string, glyph: string][] = [
  ["Self", "XXI", "◯"], ["Magician", "I", "∞"], ["Ruler", "IV", "♔"], ["Explorer", "0", "✧"], ["Sage", "IX", "✶"],
  ["Creator", "III", "♀"], ["Shadow", "XVIII", "☾"], ["Trickster", "7", "†"], ["Persona", "II", "◐"],
];
const SHADES = [61, 62, 98, 134, 140, 176, 175, 181, 223];
const CARD = 7;

const center = (s: string, w: number) => { const l = Math.floor((w - s.length) / 2); return " ".repeat(Math.max(0, l)) + s + " ".repeat(Math.max(0, w - l - s.length)); };

// Names are wider than a card, so they alternate between two lines, centred under their card.
function names(parity: number): string {
  let line = "", plain = 0;
  CARDS.forEach(([role], i) => {
    if (i % 2 !== parity) return;
    const start = 2 + i * CARD + Math.floor((CARD - role.length) / 2);
    line += " ".repeat(Math.max(0, start - plain)) + paint(`38;5;${SHADES[i]}`)(role);
    plain = Math.max(plain, start) + role.length;
  });
  return line;
}

export function banner(): string {
  const row = (f: (n: string, g: string) => string) =>
    "  " + CARDS.map(([, n, g], i) => paint(`38;5;${SHADES[i]}`)(f(n, g))).join("");
  return [
    row(() => "╭─────╮"),
    row(n => `│${center(n, 5)}│`),
    row(() => "│     │"),
    row((_, g) => `│  ${g}  │`),
    row(() => "│     │"),
    row(() => "╰─────╯"),
    names(0),
    names(1),
    "",
    "  " + c.bold("u n c o n s c i o u s") + c.dim("   d e v e l o p m e n t"),
    "  " + c.dim("A cast of agents takes an issue from approved spec to reviewed diff."),
  ].join("\n");
}

const signature = (cmd: Command) => `${cmd.name}${cmd.args ? ` ${cmd.args}` : ""}`;

export function overview(): string {
  const width = Math.max(...COMMANDS.map(cmd => signature(cmd).length)) + 2;
  const out = [banner(), "", `${c.head("Usage")}  unconscious ${c.cmd("<command>")} ${c.arg("[options]")}`];
  for (const g of GROUPS) {
    out.push("", c.head(g));
    for (const cmd of COMMANDS.filter(x => x.group === g)) {
      const sig = signature(cmd);
      const [first, ...more] = wrap(cmd.summary, Math.max(30, columns() - width - 2));
      out.push(`  ${c.cmd(cmd.name)}${c.arg(pad(sig.slice(cmd.name.length), width - cmd.name.length))}${first}`);
      for (const l of more) out.push(" ".repeat(width + 2) + l);
    }
  }
  out.push(
    "",
    c.head("More"),
    `  unconscious help ${c.cmd("<command>")}${" ".repeat(Math.max(1, width - 26))}options and examples for one command`,
    `  ${pad("docs/Quickstart.md", width)}one change from issue to merged PR`,
    `  ${pad("docs/Glossary.md", width)}what each name means`,
  );
  return out.join("\n");
}

export function commandHelp(name: string): string | undefined {
  const cmd = COMMANDS.find(x => x.name === name);
  if (!cmd) return undefined;
  const out = [`${c.cmd(`unconscious ${cmd.name}`)}  ${cmd.summary}`, "", c.head("Usage")];
  out.push(`  unconscious ${cmd.name}${cmd.args ? ` ${c.arg(cmd.args)}` : ""}`);
  for (const u of cmd.usage ?? []) out.push(`  unconscious ${cmd.name} ${c.arg(u)}`);
  if (cmd.details) out.push("", ...cmd.details.split("\n").flatMap((p, i) => [...(i ? [""] : []), ...wrap(p, Math.min(columns(), 100) - 4).map(l => `  ${l}`)]));
  const table = (title: string, rows: [string, string][], color: (s: string) => string) => {
    const w = Math.max(...rows.map(r => r[0].length)) + 2;
    out.push("", c.head(title), ...rows.map(([a, b]) => `  ${color(pad(a, w))}${b}`.trimEnd()));
  };
  if (cmd.options?.length) table("Options", cmd.options, c.arg);
  if (cmd.env?.length) table("Environment", cmd.env.map(e => [e, ENV[e] ?? ""]), c.arg);
  if (cmd.examples?.length) {
    out.push("", c.head("Examples"));
    const w = Math.max(...cmd.examples.map(e => e[0].length)) + 3;
    for (const [ex, what] of cmd.examples) out.push(`  ${c.dim("$")} ${what ? pad(ex, w) + c.dim(`# ${what}`) : ex}`);
  }
  return out.join("\n");
}

function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && line.length + word.length + 1 > width) { lines.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

// The closest command name, for a typo.
export function suggest(name: string): string | undefined {
  const dist = (a: string, b: string) => {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++)
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  };
  const best = COMMANDS.map(x => ({ name: x.name, d: dist(name, x.name) })).sort((a, b) => a.d - b.d)[0];
  return best && best.d <= Math.max(2, Math.floor(name.length / 3)) ? best.name : undefined;
}

// `unconscious help [command]`, and what an unknown command prints. Returns the exit code.
export function help(args: string[]): number {
  const [name] = args;
  if (!name) { console.log(overview()); return 0; }
  const text = commandHelp(name);
  if (text) { console.log(text); return 0; }
  const near = suggest(name);
  console.error(`unconscious: no command "${name}".${near ? ` Did you mean ${c.cmd(near)}?` : ""}`);
  console.error(`Run ${c.cmd("unconscious help")} to see them all.`);
  return 2;
}
