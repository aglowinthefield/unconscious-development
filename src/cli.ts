import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  checkFiles, checkIssueBody, findPlanForIssue, isPlan, planPathFor, readPlan, readSpec, specFiles, specPathFor, type Problem,
} from "./spec.ts";
import { taskFromIssue, tasksFromPlan } from "./tasks.ts";
import { githubTracker, repoFromRemote } from "./tracker/github.ts";
import { stateOf, type Issue, type Tracker } from "./tracker/tracker.ts";
import { bakeryRunner } from "./runner/bakery.ts";
import { sessionRunner } from "./runner/session.ts";
import type { Runner, TaskInput } from "./runner/runner.ts";

const USAGE = `usage:
  unconscious check-spec [--root DIR] [FILE...]       check docs/specs/** (or the files given)
  unconscious check-spec --issue N [--repo O/R]        check a trivial issue's criteria
  unconscious spec-to-tasks N [--dry-run] [--runner bakery|session] [--board ID] [--root DIR] [--repo O/R]
  unconscious on-merge --base SHA [--head SHA] [--runner …] [--board ID] [--root DIR] [--repo O/R]`;

class Refusal extends Error {}

function report(problems: Problem[]) {
  for (const p of problems) {
    const where = p.line ? `${p.file}:${p.line}` : p.file;
    console.error(`${where}: ${p.message}`);
    if (process.env.GITHUB_ACTIONS)
      console.log(`::error file=${p.file}${p.line ? `,line=${p.line}` : ""}::${p.message.replace(/\n/g, " ")}`);
  }
}

const onPath = (cmd: string) => {
  try { execFileSync("sh", ["-c", `command -v ${cmd}`], { stdio: "ignore" }); return true; } catch { return false; }
};

function pickRunner(name: string | undefined, root: string, board?: string): Runner {
  const chosen = name ?? (process.env.BAKERY_CLI || onPath("bakery-cli") ? "bakery" : "session");
  if (chosen === "bakery") return bakeryRunner({ cwd: root, board });
  if (chosen === "session") return sessionRunner();
  throw new Refusal(`unknown runner "${chosen}"; use bakery or session`);
}

function specToTasks(root: string, tracker: Tracker, issue: Issue, runner: Runner, dryRun: boolean): TaskInput[] {
  const problems: string[] = [];
  const state = stateOf(issue);
  if (!issue.open) problems.push(`#${issue.number} is closed`);
  if (state !== "ready-for-agent") problems.push(`#${issue.number} is ${state ?? "unlabelled"}, not ready-for-agent`);

  let tasks: TaskInput[];
  const plan = findPlanForIssue(root, issue);
  if (plan) {
    const spec = readSpec(specPathFor(plan));
    if (spec.status !== "approved") problems.push(`${spec.path.slice(root.length + 1)} is ${spec.status}, not approved`);
    const found = checkFiles(root, [specPathFor(plan), plan]);
    if (found.length) { report(found); problems.push("the spec or plan fails check-spec"); }
    const built = tasksFromPlan(root, plan, issue);
    if (built.skipped.length) console.error(`already done in the plan, skipped: ${built.skipped.join(", ")}`);
    tasks = built.tasks;
  } else {
    const found = checkIssueBody(`#${issue.number}`, issue.body);
    if (found.length) { report(found); problems.push("the issue's criteria fail check-spec"); }
    tasks = [taskFromIssue(issue)];
  }

  if (problems.length && !dryRun) throw new Refusal(`spec-to-tasks refused: ${problems.join("; ")}`);
  for (const p of problems) console.error(`would refuse: ${p}`);
  if (dryRun) {
    const preview = sessionRunner();
    tasks.forEach(t => preview.createTask(t, new Map()));
    return tasks;
  }
  const ids = new Map<string, string>();
  for (const t of tasks) {
    const id = runner.createTask(t, ids);
    ids.set(t.key, id);
    if (runner.name !== "session") console.log(`${t.key}\t${runner.name} ${id}\t${t.title}`);
  }
  return tasks;
}

// After a merge to main: every approved spec the merge touched flips its plan's issue to
// ready-for-agent and gets its tasks.
function onMerge(root: string, tracker: Tracker, runner: Runner, base: string, head: string) {
  const changed = execFileSync("git", ["diff", "--name-only", `${base}..${head}`, "--", "docs/specs"], { cwd: root, encoding: "utf8" })
    .split("\n").filter(f => f.endsWith(".md"));
  const specs = [...new Set(changed.map(f => (isPlan(f) ? specPathFor(f) : f)))]
    .map(f => join(root, f))
    .filter(p => existsSync(p) && readSpec(p).status === "approved");
  if (!specs.length) return console.log("no approved spec changed; nothing to flip");
  for (const specPath of specs) {
    const planPath = planPathFor(specPath);
    if (!existsSync(planPath)) { console.error(`${specPath}: approved with no plan; skipped`); continue; }
    const issueRef = checkFiles(root, [planPath]).length ? null : readPlan(planPath).issue;
    if (!issueRef) { console.error(`${planPath}: fails check-spec; skipped`); continue; }
    const issue = tracker.getIssue(issueRef);
    const rel = specPath.slice(root.length + 1);
    if (!issue.open || stateOf(issue) === "ready-for-agent" || stateOf(issue) === "verifying") {
      console.log(`#${issue.number} is already ${issue.open ? stateOf(issue) : "closed"}; not flipping`);
      continue;
    }
    tracker.setState(issue, "ready-for-agent");
    tracker.comment(issue, `Spec approved: \`${rel}\`. Creating its tasks.`);
    console.log(`#${issue.number} → ready-for-agent (${rel})`);
    specToTasks(root, tracker, issue, runner, false);
  }
}

function main(argv: string[]) {
  const [command, ...rest] = argv;
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      root: { type: "string" }, repo: { type: "string" }, issue: { type: "string" },
      runner: { type: "string" }, board: { type: "string" }, "dry-run": { type: "boolean" },
      base: { type: "string" }, head: { type: "string" }, help: { type: "boolean", short: "h" },
    },
  });
  if (!command || values.help) { console.log(USAGE); return 0; }
  const root = resolve(values.root ?? process.cwd());
  const tracker = () => githubTracker(values.repo ?? repoFromRemote(root));

  if (command === "check-spec") {
    if (values.issue) {
      const issue = tracker().getIssue(values.issue);
      const problems = checkIssueBody(`#${issue.number}`, issue.body);
      report(problems);
      return problems.length ? 1 : 0;
    }
    const files = positionals.length ? positionals.map(f => resolve(f)).filter(f => f.endsWith(".md")) : specFiles(root);
    const problems = checkFiles(root, files);
    report(problems);
    if (!problems.length) console.log(`check-spec: ${files.length} file${files.length === 1 ? "" : "s"} ok`);
    return problems.length ? 1 : 0;
  }
  if (command === "spec-to-tasks") {
    const ref = positionals[0] ?? values.issue;
    if (!ref) throw new Refusal("spec-to-tasks needs an issue number or URL");
    const t = tracker();
    specToTasks(root, t, t.getIssue(ref), pickRunner(values.runner, root, values.board), Boolean(values["dry-run"]));
    return 0;
  }
  if (command === "on-merge") {
    if (!values.base) throw new Refusal("on-merge needs --base SHA");
    onMerge(root, tracker(), pickRunner(values.runner, root, values.board), values.base, values.head ?? "HEAD");
    return 0;
  }
  console.error(USAGE);
  return 2;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (e) {
  if (e instanceof Refusal) { console.error(e.message); process.exitCode = 1; }
  else throw e;
}
