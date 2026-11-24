import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { parseArgs } from "node:util";
import {
  checkFiles,
  checkIssueBody,
  errorsIn,
  findPlanForIssue,
  isPlan,
  planPathFor,
  readPlan,
  readSpec,
  specFiles,
  specPathFor,
  type Problem,
} from "./spec.ts";
import { taskFromIssue, tasksFromPlan } from "./tasks.ts";
import { githubTracker, repoFromRemote } from "./tracker/github.ts";
import { STATES, stateOf, type Issue, type Tracker } from "./tracker/tracker.ts";
import { bakeryRunner } from "./runner/bakery.ts";
import { sessionRunner } from "./runner/session.ts";
import type { Runner, TaskInput } from "./runner/runner.ts";
import { isTransient, nowDir, projectPages, statusPage } from "./status.ts";
import { dueProjects } from "./propose-due.ts";
import { syncVault } from "./vault-mirror.ts";
import { piInterpreter } from "./interpret.ts";
import { pollChangeRequest, pollQuestions, type PollOptions } from "./questions.ts";
import { postCheckResult } from "./check-comment.ts";
import { domainProblem, init } from "./init.ts";
import { ask, Cancelled, doneAsking } from "./prompt.ts";
import { c, no, yes } from "./style.ts";
import { taskMerged } from "./task-merged.ts";
import { help } from "./help.ts";
import { formatStatus, setupStatus } from "./setup-status.ts";

class Refusal extends Error {}

function report(problems: Problem[]) {
  for (const p of problems) {
    const where = p.line ? `${p.file}:${p.line}` : p.file;
    console.error(`${where}: ${p.warning ? "warning: " : ""}${p.message}`);
    if (process.env.GITHUB_ACTIONS)
      console.log(
        `::${p.warning ? "warning" : "error"} file=${p.file}${p.line ? `,line=${p.line}` : ""}::${p.message.replace(/\n/g, " ")}`,
      );
  }
}

const onPath = (cmd: string) => {
  try {
    execFileSync("sh", ["-c", `command -v ${cmd}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
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
  // Approval may have only added the label; drop the state it left behind.
  else if (!dryRun && issue.labels.some((l) => l !== state && (STATES as readonly string[]).includes(l)))
    tracker.setState(issue, state);

  let tasks: TaskInput[];
  const plan = findPlanForIssue(root, issue);
  if (plan) {
    const spec = readSpec(specPathFor(plan));
    if (spec.status !== "approved")
      problems.push(`${spec.path.slice(root.length + 1)} is ${spec.status}, not approved`);
    const found = checkFiles(root, [specPathFor(plan), plan]);
    report(found);
    if (errorsIn(found).length) problems.push("the spec or plan fails check-spec");
    const built = tasksFromPlan(root, plan, issue);
    if (built.skipped.length) console.error(`already done in the plan, skipped: ${built.skipped.join(", ")}`);
    tasks = built.tasks;
  } else {
    const found = checkIssueBody(`#${issue.number}`, issue.body);
    if (found.length) {
      report(found);
      problems.push("the issue's criteria fail check-spec");
    }
    tasks = [taskFromIssue(issue)];
  }

  if (problems.length && !dryRun) throw new Refusal(`spec-to-tasks refused: ${problems.join("; ")}`);
  for (const p of problems) console.error(`would refuse: ${p}`);
  if (dryRun) {
    const preview = sessionRunner();
    tasks.forEach((t) => preview.createTask(t, new Map()));
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
  const changed = execFileSync("git", ["diff", "--name-only", `${base}..${head}`, "--", "docs/specs"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\n")
    .filter((f) => f.endsWith(".md"));
  const specs = [...new Set(changed.map((f) => (isPlan(f) ? specPathFor(f) : f)))]
    .map((f) => join(root, f))
    .filter((p) => existsSync(p) && readSpec(p).status === "approved");
  if (!specs.length) return console.log("no approved spec changed; nothing to flip");
  for (const specPath of specs) {
    const planPath = planPathFor(specPath);
    if (!existsSync(planPath)) {
      console.error(`${specPath}: approved with no plan; skipped`);
      continue;
    }
    const issueRef = errorsIn(checkFiles(root, [planPath])).length ? null : readPlan(planPath).issue;
    if (!issueRef) {
      console.error(`${planPath}: fails check-spec; skipped`);
      continue;
    }
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

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  if (!command || command === "help" || command === "-h" || command === "--help") return help(rest);
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      root: { type: "string" },
      repo: { type: "string" },
      issue: { type: "string" },
      runner: { type: "string" },
      board: { type: "string" },
      "dry-run": { type: "boolean" },
      base: { type: "string" },
      head: { type: "string" },
      dir: { type: "string" },
      help: { type: "boolean", short: "h" },
      pr: { type: "string" },
      domain: { type: "string" },
      branch: { type: "string" },
      yes: { type: "boolean", short: "y" },
      "via-pr": { type: "boolean" },
      title: { type: "string" },
      "body-tail": { type: "string" },
    },
  });
  if (values.help) return help([command]);
  const root = resolve(values.root ?? process.cwd());
  const tracker = () => githubTracker(values.repo ?? repoFromRemote(root));

  if (command === "status") {
    console.log(formatStatus(setupStatus(resolve(import.meta.dirname, ".."))));
    return 0;
  }
  if (command === "init") {
    const git = (args: string[], cwd: string) =>
      execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    let top: string;
    try {
      top = git(["rev-parse", "--show-toplevel"], root);
    } catch {
      throw new Refusal(`${root} isn't a git repo; run init from your project's repo`);
    }
    const udRoot = resolve(import.meta.dirname, "..");
    if (top === udRoot) throw new Refusal("run init from your project's repo, not from Unconscious Development itself");
    const udSha = git(["rev-parse", "HEAD"], udRoot);
    let owner: string | undefined;
    try {
      owner = git(["config", "user.name"], top) || undefined;
    } catch {}
    let domain = values.domain;
    const dryRun = Boolean(values["dry-run"]);
    // On a terminal with no --domain, ask for what the flags would have said, then confirm.
    const interactive = !values.domain && !values.yes && Boolean(process.stdin.isTTY && process.stdout.isTTY);
    if (interactive) {
      console.log(`Setting up ${c.bold(top)} for Unconscious Development.\n`);
      const personas = existsSync(join(top, "docs/personas"))
        ? readdirSync(join(top, "docs/personas"))
            .filter((f) => f.endsWith(".md"))
            .map((f) => f.slice(0, -3))
        : [];
      if (personas.length) console.log(c.dim(`Domains with a Persona already: ${personas.join(", ")}`));
      console.log(c.dim("A domain is an area of the code with its own rules, like billing. Each spec belongs to one."));
      for (;;) {
        domain = (await ask(`First domain ${c.dim("(blank to skip)")}: `)).trim() || undefined;
        const problem = domain && domainProblem(domain);
        if (!problem) break;
        console.log(no(problem));
      }
      if (domain) owner = (await ask(`Its owner ${c.dim(`(${owner ?? "you"})`)}: `)).trim() || owner;
    }
    const run = (dry: boolean) => {
      try {
        return init(top, { udRoot, udSha, domain, owner, dryRun: dry });
      } catch (e: any) {
        throw new Refusal(e.message);
      }
    };
    let r = run(interactive || dryRun);
    if (interactive) {
      console.log("");
      for (const f of r.created) console.log(`  ${c.ok("+")} ${f}`);
      for (const f of r.kept) console.log(`  ${c.dim(`= ${f} (exists, left alone)`)}`);
      if (!r.created.length) console.log("\nNothing to create.");
      else if (dryRun) console.log(c.dim("\n--dry-run: nothing written."));
      else if (
        /^n/i.test(
          (
            await ask(`\nCreate ${r.created.length} file${r.created.length === 1 ? "" : "s"}? ${c.dim("[Y/n]")} `)
          ).trim(),
        )
      ) {
        console.log("Nothing written.");
        return 1;
      } else {
        r = run(false);
        console.log(yes(`created ${r.created.length} file${r.created.length === 1 ? "" : "s"}`));
      }
    } else {
      const verb = dryRun ? "would create" : "created";
      for (const f of r.created) console.log(`${verb} ${f}`);
      for (const f of r.kept) console.log(`exists, left alone: ${f}`);
    }
    try {
      if (!git(["branch", "-r", "--contains", udSha], udRoot))
        console.log(
          `\nwarning: the workflow pins ${udSha.slice(0, 7)}, which isn't pushed; CI can't fetch it until it is`,
        );
    } catch {}
    console.log(`\n${c.head("Next")}`);
    r.next.forEach((n, i) => console.log(`${i + 1}. ${n}`));
    return 0;
  }
  if (command === "task-merged") {
    if (!values.pr && !values.head)
      throw new Refusal("task-merged needs --pr N, or --head SHA for the PRs a push merged");
    const t = tracker();
    const changes = values.pr ? [t.getChange(values.pr)] : t.mergedChangesIn(values.base ?? "", values.head!);
    if (!values.pr) console.log(`PRs merged in this push: ${changes.map((c) => `#${c.number}`).join(", ") || "none"}`);
    taskMerged(root, t, changes, {
      branch: values.branch,
      viaPr: Boolean(values["via-pr"]),
      title: values.title,
      tail: values["body-tail"] ? readFileSync(resolve(values["body-tail"]), "utf8") : undefined,
      dryRun: Boolean(values["dry-run"]),
    });
    return 0;
  }
  if (command === "check-spec") {
    if (values.issue) {
      const issue = tracker().getIssue(values.issue);
      const problems = checkIssueBody(`#${issue.number}`, issue.body);
      report(problems);
      return problems.length ? 1 : 0;
    }
    const files = positionals.length
      ? positionals.map((f) => resolve(f)).filter((f) => f.endsWith(".md"))
      : specFiles(root);
    const problems = checkFiles(root, files);
    const failed = errorsIn(problems).length;
    report(problems);
    if (!failed) console.log(`check-spec: ${files.length} file${files.length === 1 ? "" : "s"} ok`);
    if (values.pr) {
      // The comment only explains the result; failing to post it (a fork's read-only token) doesn't
      // change it.
      try {
        const t = tracker();
        console.log(
          postCheckResult(t, t.getChangeRequest(values.pr), problems, { dryRun: Boolean(values["dry-run"]) }),
        );
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
      self: (process.env.UD_SELF ?? "").split(/[\s,]+/).filter(Boolean),
      dryRun: Boolean(values["dry-run"]),
      interpreter: piInterpreter(),
    };
    if (values.pr) {
      const t = tracker();
      pollChangeRequest(t, t.getChangeRequest(values.pr), opts).forEach((l) => console.log(l));
      return 0;
    }
    let failed = 0;
    for (const page of projectPages(values.dir ? resolve(values.dir) : nowDir(), positionals[0])) {
      try {
        pollQuestions(githubTracker(page.repo), opts).forEach((l) => console.log(`${page.repo}${l}`));
      } catch (e: any) {
        failed++;
        console.error(`${page.file}: ${String(e.stderr || e.message).split("\n")[0]}`);
      }
    }
    return failed ? 1 : 0;
  }
  if (command === "mirror") {
    const dir = values.dir ? resolve(values.dir) : nowDir();
    let failed = 0;
    for (const { name, fm } of projectPages(dir, positionals[0])) {
      if (typeof fm.vault !== "string" || typeof fm.path !== "string") continue;
      const checkout = fm.path.replace(/^~(?=\/)/, homedir());
      if (!existsSync(checkout)) {
        console.error(`${name}: ${checkout} is missing`);
        failed++;
        continue;
      }
      try {
        execFileSync("git", ["fetch", "-q", "origin", "main"], { cwd: checkout, stdio: ["ignore", "pipe", "pipe"] });
      } catch (e: any) {
        console.error(`${name}: fetch failed: ${String(e.stderr || e.message).split("\n")[0]}`);
        failed++;
        continue;
      }
      const problems = syncVault(fm, dirname(dir));
      for (const p of problems) console.error(`${name}: ${p}`);
      if (problems.length) failed++;
    }
    console.log(`mirror: ${failed ? `${failed} project(s) had problems` : "every vault mirror is at origin/main"}`);
    return failed ? 1 : 0;
  }
  if (command === "propose-due") {
    const dir = values.dir ? resolve(values.dir) : nowDir();
    for (const page of dueProjects(dir)) console.log(page);
    return 0;
  }
  if (command === "status-page") {
    const dir = values.dir ? resolve(values.dir) : nowDir();
    const rows = statusPage(dir, positionals[0]);
    const failed = rows.filter((r) => !r.snapshot);
    for (const r of failed)
      console.error(`${r.file}: ${r.error}${isTransient(r.error) ? " (GitHub hiccup; next run retries)" : ""}`);
    console.log(`status-page: ${rows.length - failed.length} of ${rows.length} project pages rebuilt in ${dir}`);
    return failed.some((r) => !isTransient(r.error)) ? 1 : 0;
  }
  return help([command]);
}

try {
  process.exitCode = await main(process.argv.slice(2));
  doneAsking();
} catch (e) {
  doneAsking();
  if (e instanceof Cancelled) {
    console.error("\nCancelled; nothing written.");
    process.exitCode = 130;
  } else if (e instanceof Refusal) {
    console.error(e.message);
    process.exitCode = 1;
  } else if ((e as any)?.code?.startsWith?.("ERR_PARSE_ARGS")) {
    console.error(
      `unconscious ${process.argv[2]}: ${(e as Error).message.split(". ")[0]}.\nRun unconscious help ${process.argv[2]} for its options.`,
    );
    process.exitCode = 2;
  } else throw e;
}
