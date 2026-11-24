// The status page: `🌀 Now/<project>.md`, rebuilt from the tracker and the repo with no agent in it.
// A project page is any page in the folder whose frontmatter has `repo: owner/name`. The script owns
// the sections it writes and keeps every other section (Proposed next, notes) as it was.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { parseDoc, section, type Frontmatter } from "./markdown.ts";
import { parseTasks } from "./spec.ts";
import { syncVault } from "./vault-mirror.ts";

export const OWNED = ["Waiting on you", "Stuck", "In flight", "Ready", "Last updated"];
const STATE_LABELS = ["needs-spec", "ready-for-agent", "ready-for-human", "verifying"];

export type Checks = "failing" | "pending" | "green" | "none";

export interface PR {
  number: number;
  url: string;
  title: string;
  draft: boolean;
  createdAt: string;
  review: string; // APPROVED, CHANGES_REQUESTED, REVIEW_REQUIRED or ""
  mergeable: string; // mergeStateStatus
  checks: Checks;
  autoMerge: boolean;
}

export interface IssueRef {
  number: number;
  url: string;
  title: string;
  labels: string[];
}

export interface SpecState {
  path: string;
  status: string; // "approved", or "draft" when tasks merged before anyone approved it
  issues: string[];
  done: number;
  total: number;
}

export interface MainRun {
  workflow: string;
  conclusion: string;
  status: string;
  at: string;
  url: string;
}

export interface Snapshot {
  repo: string;
  at: string;
  mine: PR[];
  reviewRequested: PR[];
  issues: IssueRef[];
  specs: SpecState[];
  main: MainRun | null;
  limits: string[];
}

// ---- gathering ---------------------------------------------------------------------------------

const run = (cmd: string, args: string[], cwd?: string) =>
  execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 << 20 }).trim();

export function checksOf(rollup: any[]): Checks {
  if (!rollup?.length) return "none";
  let pending = false;
  for (const c of rollup) {
    const result = c.__typename === "StatusContext" ? c.state : c.status === "COMPLETED" ? c.conclusion : "PENDING";
    if (["FAILURE", "ERROR", "TIMED_OUT", "ACTION_REQUIRED", "STARTUP_FAILURE"].includes(result)) return "failing";
    if (["PENDING", "EXPECTED", "QUEUED", "IN_PROGRESS", "WAITING", "REQUESTED"].includes(result)) pending = true;
  }
  return pending ? "pending" : "green";
}

const PR_FIELDS =
  "number,url,title,isDraft,createdAt,reviewDecision,mergeStateStatus,statusCheckRollup,autoMergeRequest";
const toPR = (j: any): PR => ({
  number: j.number,
  url: j.url,
  title: j.title,
  draft: j.isDraft,
  createdAt: j.createdAt,
  review: j.reviewDecision ?? "",
  mergeable: j.mergeStateStatus ?? "",
  checks: checksOf(j.statusCheckRollup),
  autoMerge: !!j.autoMergeRequest,
});

function prs(repo: string, search: string): PR[] {
  return JSON.parse(
    run("gh", ["pr", "list", "-R", repo, "--search", search, "--limit", "100", "--json", PR_FIELDS]),
  ).map(toPR);
}

// Specs from the remote's main, so a stale local checkout doesn't matter.
function specsOnMain(path: string): SpecState[] {
  try {
    run("git", ["fetch", "-q", "origin", "main"], path);
  } catch {
    /* offline: use what we have */
  }
  let files: string[];
  try {
    files = run("git", ["ls-tree", "-r", "--name-only", "origin/main", "docs/specs"], path).split("\n").filter(Boolean);
  } catch {
    return [];
  }
  const show = (f: string) => run("git", ["show", `origin/main:${f}`], path);
  const out: SpecState[] = [];
  for (const f of files.filter((f) => f.endsWith(".md") && !f.endsWith(".plan.md"))) {
    const spec = parseDoc(show(f));
    const status = String(spec.frontmatter?.status ?? "");
    if (status !== "approved" && status !== "draft") continue;
    const planFile = f.replace(/\.md$/, ".plan.md");
    const tasksBody = files.includes(planFile) ? (section(parseDoc(show(planFile)), "Tasks")?.body ?? "") : "";
    const tasks = parseTasks(tasksBody);
    if (status === "draft" && !tasks.some((t) => t.done)) continue; // an ordinary draft
    const issues = spec.frontmatter?.issues;
    out.push({
      path: f,
      status,
      issues: Array.isArray(issues) ? issues : issues ? [issues] : [],
      done: tasks.filter((t) => t.done).length,
      total: tasks.length,
    });
  }
  return out;
}

export function gather(fm: Frontmatter, now = new Date()): Snapshot {
  const repo = String(fm.repo);
  const limits: string[] = [];
  const mine = [...prs(repo, "is:open author:@me"), ...prs(repo, "is:open assignee:@me -author:@me")];
  const reviewRequested = prs(repo, "is:open user-review-requested:@me -author:@me");
  const issues: IssueRef[] = JSON.parse(
    run("gh", [
      "issue",
      "list",
      "-R",
      repo,
      "--search",
      `is:open label:${STATE_LABELS.join(",")}`,
      "--limit",
      "100",
      "--json",
      "number,url,title,labels",
    ]),
  ).map((j: any) => ({ number: j.number, url: j.url, title: j.title, labels: j.labels.map((l: any) => l.name) }));

  const path = typeof fm.path === "string" ? fm.path.replace(/^~(?=\/)/, homedir()) : "";
  let specs: SpecState[] = [];
  if (path && existsSync(path)) specs = specsOnMain(path);
  else limits.push(path ? `${fm.path} not found, so specs weren't read` : "no `path:`, so specs weren't read");

  const runs = JSON.parse(
    run("gh", [
      "run",
      "list",
      "-R",
      repo,
      "--branch",
      "main",
      "--limit",
      "30",
      "--json",
      "workflowName,conclusion,status,createdAt,url,event",
    ]),
  );
  const ci = typeof fm.ci === "string" ? fm.ci : null;
  const r = runs.find((r: any) => (ci ? r.workflowName === ci : r.event === "push"));
  const main = r
    ? { workflow: r.workflowName, conclusion: r.conclusion, status: r.status, at: r.createdAt, url: r.url }
    : null;
  if (!main) limits.push(ci ? `no "${ci}" run in the last 30 on main` : "no push run in the last 30 on main");

  limits.push("Runner tasks aren't read yet; Bakery cards don't show here.");
  return { repo, at: now.toISOString(), mine, reviewRequested, issues, specs, main, limits };
}

// ---- rendering ---------------------------------------------------------------------------------

const days = (from: string, at: string) => Math.max(0, Math.floor((Date.parse(at) - Date.parse(from)) / 86_400_000));
const hhmm = (iso: string) => iso.slice(11, 16) + "Z";
const day = (iso: string) => iso.slice(0, 10);
const when = (iso: string, at: string) => (day(iso) === day(at) ? hhmm(iso) : `${day(iso)} ${hhmm(iso)}`);

export function prStage(p: PR): "stuck" | "yours" | "waiting" {
  if (p.checks === "failing" || p.mergeable === "DIRTY") return "stuck";
  if (p.draft || p.checks === "pending" || p.autoMerge) return "waiting";
  return "yours"; // green and ready: needs a review, or approval is in and it can merge
}

function prLine(p: PR, at: string): string {
  const age = `${days(p.createdAt, at)}d`;
  const why =
    p.mergeable === "DIRTY"
      ? "conflicts with main"
      : p.checks === "failing"
        ? "checks failing"
        : p.draft
          ? "draft"
          : p.autoMerge
            ? "set to merge when checks pass"
            : p.checks === "pending"
              ? "checks running"
              : p.review === "APPROVED"
                ? "approved, green: merge it"
                : p.review === "CHANGES_REQUESTED"
                  ? "changes requested"
                  : "green, needs a review";
  return `- ${p.url} (${age}): ${why}`;
}

const issueLine = (i: IssueRef) => `- ${i.url}`;
const has = (i: IssueRef, l: string) => i.labels.includes(l);

export function mainLine(s: Snapshot): string {
  if (!s.main) return "Main: unknown.";
  const m = s.main;
  const result = m.status !== "completed" ? "running" : m.conclusion === "success" ? "green" : m.conclusion;
  return `Main: ${m.workflow} ${result} at ${when(m.at, s.at)} (${m.url}).`;
}

// Task PRs merged against a draft spec: the approval was skipped, so nothing moves the spec or its issue on.
export const draftWork = (s: Snapshot) => s.specs.filter((sp) => sp.status === "draft");
const approved = (s: Snapshot) => s.specs.filter((sp) => sp.status !== "draft");

export function renderOwned(s: Snapshot): Record<string, string> {
  const stuck = s.mine.filter((p) => prStage(p) === "stuck");
  const yours = s.mine.filter((p) => prStage(p) === "yours");
  const waiting = s.mine.filter((p) => prStage(p) === "waiting");
  const mainRed = s.main?.status === "completed" && !["success", "skipped", "neutral"].includes(s.main.conclusion);

  const out: Record<string, string> = {};
  const block = (lines: string[], empty: string) => (lines.length ? lines.join("\n") : empty);

  out["Waiting on you"] = block(
    [
      ...yours.map((p) => prLine(p, s.at)),
      ...s.reviewRequested.map((p) => `- ${p.url} (${days(p.createdAt, s.at)}d): review requested`),
      ...s.issues.filter((i) => has(i, "ready-for-human")).map((i) => `${issueLine(i)}: ready for a human`),
      ...s.issues.filter((i) => has(i, "needs-spec")).map((i) => `${issueLine(i)}: needs a spec`),
    ],
    "Nothing.",
  );

  out["Stuck"] = block(
    [
      ...(mainRed ? [`- ${mainLine(s)}`] : []),
      ...stuck.map((p) => prLine(p, s.at)),
      ...draftWork(s).map(
        (sp) =>
          `- \`${sp.path}\`: ${sp.done} of ${sp.total} tasks done, but the spec is still \`draft\`. Approve it, or mark it built${sp.issues.length ? ` and move ${sp.issues.join(", ")} on` : ""}.`,
      ),
    ],
    "Nothing.",
  );

  const flight: string[] = [];
  if (approved(s).length) {
    flight.push("### Specs", "");
    for (const sp of approved(s))
      flight.push(
        `- \`${sp.path}\`: ${sp.done} of ${sp.total} tasks done${sp.issues.length ? `, ${sp.issues.join(", ")}` : ""}`,
      );
    flight.push("");
  }
  if (waiting.length) flight.push("### Your PRs", "", ...waiting.map((p) => prLine(p, s.at)), "");
  const verifying = s.issues.filter((i) => has(i, "verifying"));
  if (verifying.length) flight.push("### Verifying after deploy", "", ...verifying.map(issueLine), "");
  out["In flight"] = flight.length ? flight.join("\n").trimEnd() : "Nothing.";

  out["Ready"] = block(s.issues.filter((i) => has(i, "ready-for-agent")).map(issueLine), "Nothing ready for an agent.");

  out["Last updated"] = [
    `${s.at.slice(0, 16)}Z by \`unconscious status-page\`. ${mainLine(s)}`,
    "",
    ...s.limits.map((l) => `- ${l}`),
  ].join("\n");
  return out;
}

// Rewrites the page: frontmatter gets `updated`, owned sections are replaced in OWNED order, every
// other section keeps its text and goes after "Ready", before "Last updated". Proposed next goes
// first, so the page opens on what to do.
const FIRST = "Proposed next";
export function renderPage(previous: string, s: Snapshot): string {
  const lines = previous.replace(/\r\n/g, "\n").split("\n");
  let fmLines: string[] = [];
  let rest = previous;
  if (lines[0] === "---") {
    const end = lines.indexOf("---", 1);
    fmLines = lines.slice(1, end).filter((l) => !l.startsWith("updated:"));
    rest = lines.slice(end + 1).join("\n");
  }
  const doc = parseDoc(rest);
  const owned = renderOwned(s);
  const keep = (x: { heading: string; body: string }) => `## ${x.heading}\n${x.body.trimEnd()}\n`;
  const kept = doc.sections.filter((x) => !OWNED.includes(x.heading));
  const first = kept.filter((x) => x.heading === FIRST).map(keep);
  const others = kept.filter((x) => x.heading !== FIRST).map(keep);
  const sec = (h: string) => `## ${h}\n\n${owned[h]}\n`;
  return [
    "---",
    ...fmLines,
    `updated: ${s.at.slice(0, 19)}Z`,
    "---",
    "",
    ...first,
    ...["Waiting on you", "Stuck", "In flight", "Ready"].map(sec),
    ...others,
    sec("Last updated"),
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

// ---- the index ---------------------------------------------------------------------------------

export interface Row {
  name: string;
  file: string;
  snapshot: Snapshot | null;
  error?: string;
  next?: string;
}

// The first proposal in a page's Proposed next section, shortened for a table cell:
// "[#6680](url): safety.ts prices Gemini at retired flash-lite rates".
export function firstProposal(page: string): string | undefined {
  const body = section(parseDoc(page), "Proposed next")?.body;
  // The Do next callout ("> [!tip] Do next: URL" then "> why"), or a numbered list's first line.
  const tip = body && /^>\s*\[!tip\][^:\n]*:\s*(.+)\n>\s*(.+)$/m.exec(body);
  const line = tip ? `${tip[1].trim()}: ${tip[2].trim()}` : body && /^1\.\s+(.+)$/m.exec(body)?.[1];
  if (!line) return undefined;
  const url = /https:\/\/github\.com\/[^\s,)]+\/(?:issues|pull)\/(\d+)/.exec(line);
  const reason = (line.split(/:\s+/).slice(1).join(": ") || line).split(/(?<=[^.]{12})\.\s/)[0].replace(/\.$/, "");
  const text = reason.length > 90 ? reason.slice(0, 89).trimEnd() + "…" : reason;
  // Without an issue link, the proposal's own lead ("[[Token sources]]", "Fix red main") names it.
  const lead = url ? `[#${url[1]}](${url[0]})` : line.split(/[,:]\s/)[0];
  return `${lead}: ${text}`.replace(/\|/g, "\\|");
}

export function renderProjects(rows: Row[]): string {
  const head = "| Project | Waiting on you | Stuck | In flight | Main | Next |\n| --- | --- | --- | --- | --- | --- |";
  const body = rows.map((r) => {
    const link = `[[${basename(r.file, ".md")}\\|${r.name}]]`; // escaped: a bare | splits the table cell
    const next = r.next ?? "run `propose`";
    if (!r.snapshot) return `| ${link} | | | | unknown | ${next} |`; // the CLI prints the error to stderr
    const o = r.snapshot;
    const waiting =
      o.mine.filter((p) => prStage(p) === "yours").length +
      o.reviewRequested.length +
      o.issues.filter((i) => has(i, "ready-for-human") || has(i, "needs-spec")).length;
    const stuck = o.mine.filter((p) => prStage(p) === "stuck").length + draftWork(o).length;
    const flight =
      approved(o).length +
      o.mine.filter((p) => prStage(p) === "waiting").length +
      o.issues.filter((i) => has(i, "verifying")).length;
    const main = !o.main
      ? "unknown"
      : o.main.status !== "completed"
        ? "running"
        : o.main.conclusion === "success"
          ? "green"
          : o.main.conclusion;
    const n = (x: number) => (x ? String(x) : "");
    return `| ${link} | ${n(waiting)} | ${n(stuck)} | ${n(flight)} | ${main} | ${next} |`;
  });
  return `${head}\n${body.join("\n")}\n\nRebuilt by \`unconscious status-page\`. A project is any page here with \`repo:\` in its frontmatter.`;
}

export function replaceSection(text: string, heading: string, body: string): string {
  const re = new RegExp(`(^## ${heading}\\n)[\\s\\S]*?(?=^## |(?![\\s\\S]))`, "m");
  const block = `## ${heading}\n\n${body.trimEnd()}\n\n`;
  return re.test(text) ? text.replace(re, block).trimEnd() + "\n" : `${text.trimEnd()}\n\n${block}`.trimEnd() + "\n";
}

// ---- the command -------------------------------------------------------------------------------

export function nowDir(): string {
  const candidates = [
    process.env.UD_NOW_DIR,
    process.env.DEV_VAULT && join(process.env.DEV_VAULT, "🌀 Now"),
    join(homedir(), "Documents/somewhere.garden/🌀 Now"),
  ];
  const dir = candidates.find((d) => d && existsSync(d));
  if (!dir) throw new Error(`no 🌀 Now folder; set UD_NOW_DIR`);
  return dir;
}

const write = (path: string, text: string) => {
  writeFileSync(path + ".tmp", text);
  renameSync(path + ".tmp", path);
};

export interface ProjectPage {
  name: string;
  file: string;
  path: string;
  text: string;
  fm: Frontmatter;
  repo: string;
}

// The project pages in the Now folder (or the one named `only`): pages with `repo:` in frontmatter.
export function projectPages(dir: string, only?: string): ProjectPage[] {
  const pages: ProjectPage[] = [];
  for (const f of readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f !== "index.md")
    .sort()) {
    const path = join(dir, f);
    const text = readFileSync(path, "utf8");
    const fm = parseDoc(text).frontmatter;
    if (typeof fm?.repo !== "string") continue;
    const name = typeof fm.name === "string" ? fm.name : basename(f, ".md");
    if (only && only !== name && only !== basename(f, ".md")) continue;
    pages.push({ name, file: f, path, text, fm, repo: fm.repo });
  }
  return pages;
}

// GitHub's own hiccups: a 5xx or a dropped connection. The next run, 15 minutes on, usually
// succeeds, so a page that failed only this way isn't worth failing the unit (and paging) over.
// A 403 rate limit is not one of these: it means the schedule asks GitHub too often.
export function isTransient(error: string | undefined): boolean {
  return /\bHTTP 5\d\d\b|error connecting to|connection (reset|refused)|timed? ?out|ETIMEDOUT|ECONNRESET|EAI_AGAIN/i.test(
    error ?? "",
  );
}

export function statusPage(dir: string, only?: string): Row[] {
  const rows: Row[] = [];
  for (const { name, file: f, path, text, fm } of projectPages(dir, only)) {
    try {
      const snapshot = gather(fm);
      snapshot.limits.unshift(...syncVault(fm, dirname(dir)));
      write(path, renderPage(text, snapshot));
      rows.push({ name, file: f, snapshot, next: firstProposal(text) });
    } catch (e: any) {
      rows.push({
        name,
        file: f,
        snapshot: null,
        error: String(e.stderr || e.message).split("\n")[0],
        next: firstProposal(text),
      });
    }
  }
  const index = join(dir, "index.md");
  if (!only && existsSync(index)) {
    const text = readFileSync(index, "utf8").replace(
      /^updated: .*$/m,
      `updated: ${new Date().toISOString().slice(0, 19)}Z`,
    );
    write(index, replaceSection(text, "Projects", renderProjects(rows)));
  }
  return rows;
}
