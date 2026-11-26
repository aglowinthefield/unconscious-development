// After a task PR merges: when every task of its issue has a merged PR, the change is done. The
// spec becomes `built` and its plan goes (git keeps it), then the issue closes, or moves to
// `verifying` when the spec has after-deploy criteria, which only production can settle.
//
// A task counts as done when a merged PR names its key (`gh-42/t2`) in its title or body, or
// when its box is ticked in the plan. A bare `Refs #42` isn't enough for a plan's task, because the
// spec PR says that too. A trivial issue has no spec PR and one task, so any merged PR that refers
// to it finishes it.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { findPlanForIssue, readPlan, readSpec, specPathFor, type Criterion } from "./spec.ts";
import { stateOf, type Change, type Issue, type Tracker } from "./tracker/tracker.ts";

export function taskIdsIn(text: string, issue: number): string[] {
  return [...text.matchAll(new RegExp(`\\bgh-${issue}/(t\\d+)\\b`, "g"))].map((m) => m[1]);
}

export function refersTo(text: string, issue: Issue): boolean {
  return (
    new RegExp(`(^|[^\\w/])#${issue.number}\\b`).test(text) ||
    text.includes(issue.url) ||
    taskIdsIn(text, issue.number).length > 0
  );
}

export type Decision =
  | { kind: "skip"; why: string }
  | { kind: "waiting"; left: string[] }
  | { kind: "done"; spec?: string; plan?: string; afterDeploy: Criterion[]; changes: Change[] };

export function decide(root: string, issue: Issue, merged: Change[]): Decision {
  const state = stateOf(issue);
  if (!issue.open) return { kind: "skip", why: `#${issue.number} is closed` };
  if (state !== "ready-for-agent" && state !== "ready-for-human")
    return {
      kind: "skip",
      why: `#${issue.number} is ${state ?? "unlabelled"}, not ready-for-agent or ready-for-human`,
    };
  const changes = merged.filter((c) => refersTo(`${c.title}\n${c.body}`, issue));
  if (!changes.length) return { kind: "skip", why: `no merged PR refers to #${issue.number}` };

  const planPath = findPlanForIssue(root, issue);
  if (!planPath) return { kind: "done", afterDeploy: [], changes }; // trivial: one task
  const plan = readPlan(planPath);
  const named = new Set(changes.flatMap((c) => taskIdsIn(`${c.title}\n${c.body}`, issue.number)));
  const left = plan.tasks.filter((t) => !t.done && !named.has(t.id)).map((t) => t.id);
  if (left.length) return { kind: "waiting", left };
  const specPath = specPathFor(planPath);
  const afterDeploy = existsSync(specPath) ? readSpec(specPath).criteria.filter((c) => c.afterDeploy) : [];
  return { kind: "done", spec: relative(root, specPath), plan: relative(root, planPath), afterDeploy, changes };
}

// The spec's status becomes `built` and its plan is removed, in the working tree. Returns the paths
// it changed.
export function markBuilt(root: string, d: Extract<Decision, { kind: "done" }>): string[] {
  if (!d.spec) return [];
  const specFull = `${root}/${d.spec}`;
  const text = readFileSync(specFull, "utf8");
  const built = text.replace(/^(---\n[\s\S]*?^status:)[^\n]*$/m, "$1 built");
  const changed: string[] = [];
  if (built !== text) {
    writeFileSync(specFull, built);
    changed.push(d.spec);
  }
  if (d.plan && existsSync(`${root}/${d.plan}`)) {
    rmSync(`${root}/${d.plan}`);
    changed.push(d.plan);
  }
  return changed;
}

const links = (cs: Change[]) => cs.map((c) => `#${c.number}`).join(", ");

export function closingComment(d: Extract<Decision, { kind: "done" }>, landed: string): string {
  const head = `Every task has merged (${links(d.changes)}).${d.spec ? ` ${landed}` : ""}`;
  if (!d.afterDeploy.length) return head;
  return `${head}\n\nThese criteria can only be checked in production, so this stays open as \`verifying\` until they pass:\n\n${d.afterDeploy.map((c) => `- ${c.id}: ${c.text}`).join("\n")}`;
}

// The PR that marks a spec built, when it can't be pushed straight to the base branch. The title
// is a conventional commit, `docs(<domain>): mark the <name> spec built`, since repos that gate PR
// titles mostly gate on that shape; `template` overrides it, with `{domain}` and `{name}` filled
// in. `tail` is appended to the body: a repo whose PR template has required sections puts them
// there.
export function builtChange(
  d: Extract<Decision, { kind: "done" }>,
  issue: Issue,
  opts: { template?: string; tail?: string } = {},
): { title: string; body: string } {
  const spec = d.spec ?? "";
  const name = spec.split("/").pop()!.replace(/\.md$/, "");
  const domain = spec.split("/").slice(-2, -1)[0] ?? "specs";
  const title = (opts.template ?? "docs({domain}): mark the {name} spec built")
    .replaceAll("{domain}", domain)
    .replaceAll("{name}", name);
  const body = [
    `Marks \`${spec}\` built${d.plan ? " and removes its plan" : ""}: every task of #${issue.number} has merged (${links(d.changes)}).`,
    `Refs #${issue.number}`,
    ...(opts.tail?.trim() ? [opts.tail.trim()] : []),
  ].join("\n\n");
  return { title, body };
}

// The issues a task PR is for: those it names a task key of, or says `Refs` to.
export function issuesOf(text: string): number[] {
  const keys = [...text.matchAll(/\bgh-(\d+)\/t\d+\b/g)].map((m) => Number(m[1]));
  const refs = [...text.matchAll(/\bRefs:?\s+(?:#|https:\/\/\S+\/issues\/)(\d+)\b/gi)].map((m) => Number(m[1]));
  return [...new Set([...keys, ...refs])];
}

export interface TaskMergedOptions {
  branch?: string; // where the spec change goes (default: the current branch)
  viaPr?: boolean; // always land it through a PR, never a direct push
  title?: string; // that PR's title template; see builtChange
  tail?: string; // appended to that PR's body
  dryRun?: boolean;
}

export function taskMerged(root: string, tracker: Tracker, changes: Change[], opts: TaskMergedOptions) {
  const git = (args: string[], cwd = root) =>
    execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const done = new Set<number>();
  for (const change of changes) {
    if (!change.merged) {
      console.log(`#${change.number} isn't merged; nothing to do`);
      continue;
    }
    for (const n of issuesOf(`${change.title}\n${change.body}`)) {
      if (done.has(n)) continue;
      const issue = tracker.getIssue(n);
      const merged = [change, ...tracker.mergedChangesFor(issue).filter((c) => c.merged && c.number !== change.number)];
      const d = decide(root, issue, merged);
      if (d.kind === "skip") {
        console.log(`#${n}: ${d.why}`);
        continue;
      }
      if (d.kind === "waiting") {
        console.log(`#${n}: waiting on ${d.left.join(", ")}`);
        continue;
      }
      done.add(n);
      const next = d.afterDeploy.length ? "verifying" : "closed";
      if (opts.dryRun) {
        console.log(`#${n}: every task merged; would mark ${d.spec ?? "nothing"} built and move the issue to ${next}`);
        continue;
      }

      const base = opts.branch ?? git(["rev-parse", "--abbrev-ref", "HEAD"]);
      const side = `ud/built-${n}`;
      const openPr = () => {
        const { title, body } = builtChange(d, issue, { template: opts.title, tail: opts.tail });
        return tracker.openChange({ branch: side, base, title, body });
      };
      const message = `Mark ${d.spec} built\n\nIts last task merged in #${change.number}; the plan goes with it.`;
      let landed = "";
      if (d.spec && opts.viaPr) {
        // A scratch worktree holding only the spec and plan, so the checkout it runs from is never
        // touched and each issue's change starts from the same commit.
        const tmp = mkdtempSync(join(tmpdir(), "ud-built-"));
        try {
          git(["worktree", "add", "-q", "--no-checkout", "--detach", tmp, "HEAD"]);
          git(["reset", "-q"], tmp);
          git(["checkout", "--", d.spec, ...(d.plan ? [d.plan] : [])], tmp);
          const changed = markBuilt(tmp, d);
          if (changed.length) {
            git(["add", "-A", "--", ...changed], tmp);
            git(["commit", "-q", "-m", message], tmp);
            git(["push", "-q", "-f", "origin", `HEAD:refs/heads/${side}`], tmp);
            landed = `Marking the spec \`built\` is in ${openPr()}.`;
          }
        } finally {
          try {
            git(["worktree", "remove", "--force", tmp]);
          } catch {
            rmSync(tmp, { recursive: true, force: true });
          }
        }
      } else {
        // The spec's new status lands on the base branch, or in a PR when the branch refuses a push.
        const changed = markBuilt(root, d);
        if (changed.length) {
          git(["add", "-A", "--", ...changed]);
          git(["commit", "-m", message]);
          const sha = git(["rev-parse", "--short", "HEAD"]);
          try {
            git(["push", "origin", `HEAD:${base}`]);
            landed = `The spec is now \`built\` and its plan is removed, in ${sha}.`;
          } catch {
            git(["push", "-f", "origin", `HEAD:refs/heads/${side}`]);
            landed = `${base} refused a direct push, so marking the spec \`built\` is in ${openPr()}.`;
          }
        }
      }
      if (d.afterDeploy.length) tracker.setState(issue, "verifying");
      // The comment is a courtesy: if it fails, say so and close the issue anyway.
      try {
        tracker.comment(issue, closingComment(d, landed));
      } catch (e: any) {
        console.error(`#${n}: closing comment not posted: ${String(e.stderr || e.message).split("\n")[0]}`);
      }
      if (!d.afterDeploy.length) tracker.close(issue);
      console.log(`#${n}: every task merged; ${next}${landed ? `. ${landed}` : ""}`);
    }
  }
}
