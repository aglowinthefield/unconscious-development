import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  checkFiles, checkIssueBody, errorsIn, findPlanForIssue, isPlan, planPathFor, readPlan, readSpec, specFiles, specPathFor, type Problem,
} from "./spec.ts";
import { taskFromIssue, tasksFromPlan } from "./tasks.ts";
import { githubTracker, repoFromRemote } from "./tracker/github.ts";
import { stateOf, type Issue, type Tracker } from "./tracker/tracker.ts";
import { bakeryRunner } from "./runner/bakery.ts";
import { sessionRunner } from "./runner/session.ts";
import type { Runner, TaskInput } from "./runner/runner.ts";
import { nowDir, projectPages, statusPage } from "./status.ts";
import { piInterpreter } from "./interpret.ts";
import { pollChangeRequest, pollQuestions, type PollOptions } from "./questions.ts";
import { postCheckResult } from "./check-comment.ts";
import { init } from "./init.ts";
import { closingComment, decide, markBuilt } from "./task-merged.ts";

const USAGE = `usage:
  unconscious init [--domain NAME] [--root DIR] [--dry-run]
                                                       set a repo up: docs folders, the CI workflow, a draft Persona
  unconscious check-spec [--root DIR] [FILE...]       check docs/specs/** (or the files given)
  unconscious check-spec --pr N [--repo O/R]           the same, and explain the result in a comment on PR N
  unconscious check-spec --issue N [--repo O/R]        check a trivial issue's criteria
  unconscious spec-to-tasks N [--dry-run] [--runner bakery|session] [--board ID] [--root DIR] [--repo O/R]
  unconscious task-merged --pr N [--branch B] [--root DIR] [--repo O/R] [--dry-run]
                                                       after task PR N merges, finish its issue if it was the last task
  unconscious on-merge --base SHA [--head SHA] [--runner …] [--board ID] [--root DIR] [--repo O/R]
  unconscious status-page [--dir DIR] [PROJECT]       rebuild the 🌀 Now pages (or one project's)
  unconscious questions [--dir DIR] [PROJECT] [--dry-run]
                                                       ask open [NEEDS CLARIFICATION] markers on spec PRs and apply
                                                       replies, for every project page (or one)
  unconscious questions --pr N [--repo O/R] [--dry-run] the same for one PR`;

class Refusal extends Error {}

function report(problems: Problem[]) {
  for (const p of problems) {
    const where = p.line ? `${p.file}:${p.line}` : p.file;
    console.error(`${where}: ${p.warning ? "warning: " : ""}${p.message}`);
    if (process.env.GITHUB_ACTIONS)
      console.log(`::${p.warning ? "warning" : "error"} file=${p.file}${p.line ? `,line=${p.line}` : ""}::${p.message.replace(/\n/g, " ")}`);
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
    report(found);
    if (errorsIn(found).length) problems.push("the spec or plan fails check-spec");
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
    const issueRef = errorsIn(checkFiles(root, [planPath])).length ? null : readPlan(planPath).issue;
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

// The issues a task PR is for: those it names a task key of, or says `Refs` to.
function issuesOf(text: string): number[] {
  const keys = [...text.matchAll(/\bgh-(\d+)\/t\d+\b/g)].map(m => Number(m[1]));
  const refs = [...text.matchAll(/\bRefs:?\s+(?:#|https:\/\/\S+\/issues\/)(\d+)\b/gi)].map(m => Number(m[1]));
  return [...new Set([...keys, ...refs])];
}

function taskMerged(root: string, tracker: Tracker, ref: string, branch: string | undefined, dryRun: boolean) {
  const change = tracker.getChange(ref);
  if (!change.merged) return console.log(`#${change.number} isn't merged; nothing to do`);
  const git = (args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  for (const n of issuesOf(`${change.title}\n${change.body}`)) {
    const issue = tracker.getIssue(n);
    const merged = [change, ...tracker.mergedChangesFor(issue).filter(c => c.merged && c.number !== change.number)];
    const d = decide(root, issue, merged);
    if (d.kind === "skip") { console.log(`#${n}: ${d.why}`); continue; }
    if (d.kind === "waiting") { console.log(`#${n}: waiting on ${d.left.join(", ")}`); continue; }
    const next = d.afterDeploy.length ? "verifying" : "closed";
    if (dryRun) { console.log(`#${n}: every task merged; would mark ${d.spec ?? "nothing"} built and move the issue to ${next}`); continue; }

    // The spec's new status lands on the base branch, or in a PR when the branch refuses a push.
    let landed = "";
    const changed = markBuilt(root, d);
    if (changed.length) {
      const base = branch ?? git(["rev-parse", "--abbrev-ref", "HEAD"]);
      git(["add", "-A", "--", ...changed]);
      git(["commit", "-m", `Mark ${d.spec} built\n\nIts last task merged in #${change.number}; the plan goes with it.`]);
      const sha = git(["rev-parse", "--short", "HEAD"]);
      try {
        git(["push", "origin", `HEAD:${base}`]);
        landed = `The spec is now \`built\` and its plan is removed, in ${sha}.`;
      } catch {
        const side = `ud/built-${n}`;
        git(["push", "-f", "origin", `HEAD:refs/heads/${side}`]);
        const url = tracker.openChange({ branch: side, base, title: `Mark ${d.spec} built`, body: `Its last task merged in #${change.number}. Refs #${n}` });
        landed = `${base} refused a direct push, so marking the spec \`built\` is in ${url}.`;
      }
    }
    if (d.afterDeploy.length) tracker.setState(issue, "verifying");
    tracker.comment(issue, closingComment(d, landed));
    if (!d.afterDeploy.length) tracker.close(issue);
    console.log(`#${n}: every task merged; ${next}${landed ? `. ${landed}` : ""}`);
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
      base: { type: "string" }, head: { type: "string" }, dir: { type: "string" }, help: { type: "boolean", short: "h" },
      pr: { type: "string" }, domain: { type: "string" }, branch: { type: "string" },
    },
  });
  if (!command || values.help) { console.log(USAGE); return 0; }
  const root = resolve(values.root ?? process.cwd());
  const tracker = () => githubTracker(values.repo ?? repoFromRemote(root));

  if (command === "init") {
    const git = (args: string[], cwd: string) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    let top: string;
    try { top = git(["rev-parse", "--show-toplevel"], root); } catch { throw new Refusal(`${root} isn't a git repo; run init from your project's repo`); }
    const udRoot = resolve(import.meta.dirname, "..");
    if (top === udRoot) throw new Refusal("run init from your project's repo, not from Unconscious Development itself");
    const udSha = git(["rev-parse", "HEAD"], udRoot);
    let owner: string | undefined;
    try { owner = git(["config", "user.name"], top) || undefined; } catch {}
    let r;
    try { r = init(top, { udRoot, udSha, domain: values.domain, owner, dryRun: Boolean(values["dry-run"]) }); }
    catch (e: any) { throw new Refusal(e.message); }
    const verb = values["dry-run"] ? "would create" : "created";
    for (const f of r.created) console.log(`${verb} ${f}`);
    for (const f of r.kept) console.log(`exists, left alone: ${f}`);
    try { if (!git(["branch", "-r", "--contains", udSha], udRoot)) console.log(`\nwarning: the workflow pins ${udSha.slice(0, 7)}, which isn't pushed; CI can't fetch it until it is`); } catch {}
    console.log("\nNext:");
    r.next.forEach((n, i) => console.log(`${i + 1}. ${n}`));
    return 0;
  }
  if (command === "task-merged") {
    if (!values.pr) throw new Refusal("task-merged needs --pr N");
    taskMerged(root, tracker(), values.pr, values.branch, Boolean(values["dry-run"]));
    return 0;
  }
  if (command === "check-spec") {
    if (values.issue) {
      const issue = tracker().getIssue(values.issue);
      const problems = checkIssueBody(`#${issue.number}`, issue.body);
      report(problems);
      return problems.length ? 1 : 0;
    }
    const files = positionals.length ? positionals.map(f => resolve(f)).filter(f => f.endsWith(".md")) : specFiles(root);
    const problems = checkFiles(root, files);
    const failed = errorsIn(problems).length;
    report(problems);
    if (!failed) console.log(`check-spec: ${files.length} file${files.length === 1 ? "" : "s"} ok`);
    if (values.pr) {
      // The comment only explains the result; failing to post it (a fork's read-only token) doesn't
      // change it.
      try {
        const t = tracker();
        console.log(postCheckResult(t, t.getChangeRequest(values.pr), problems, { dryRun: Boolean(values["dry-run"]) }));
      } catch (e: any) {
        const msg = `check comment not posted: ${String(e.stderr || e.message).split("\n")[0]}`;
        console.log(process.env.GITHUB_ACTIONS ? `::warning::${msg}` : msg);
      }
    }
    return failed ? 1 : 0;
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
  if (command === "questions") {
    const opts: PollOptions = {
      self: (process.env.UD_SELF ?? "").split(/[\s,]+/).filter(Boolean), dryRun: Boolean(values["dry-run"]), interpreter: piInterpreter(),
    };
    if (values.pr) {
      const t = tracker();
      pollChangeRequest(t, t.getChangeRequest(values.pr), opts).forEach(l => console.log(l));
      return 0;
    }
    let failed = 0;
    for (const page of projectPages(values.dir ? resolve(values.dir) : nowDir(), positionals[0])) {
      try {
        pollQuestions(githubTracker(page.repo), opts).forEach(l => console.log(`${page.repo}${l}`));
      } catch (e: any) {
        failed++;
        console.error(`${page.file}: ${String(e.stderr || e.message).split("\n")[0]}`);
      }
    }
    return failed ? 1 : 0;
  }
  if (command === "status-page") {
    const dir = values.dir ? resolve(values.dir) : nowDir();
    const rows = statusPage(dir, positionals[0]);
    const failed = rows.filter(r => !r.snapshot);
    for (const r of failed) console.error(`${r.file}: ${r.error}`);
    console.log(`status-page: ${rows.length - failed.length} of ${rows.length} project pages rebuilt in ${dir}`);
    return failed.length ? 1 : 0;
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
