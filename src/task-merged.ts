// After a task PR merges: when every task of its issue has a merged PR, the change is done. The
// spec becomes `built` and its plan goes (git keeps it), then the issue closes, or moves to
// `verifying` when the spec has after-deploy criteria, which only production can settle.
//
// A task counts as done when a merged PR names its key (`gh-42/t2`) in its title or body, or
// when its box is ticked in the plan. A bare `Refs #42` isn't enough for a plan's task, because the
// spec PR says that too. A trivial issue has no spec PR and one task, so any merged PR that refers
// to it finishes it.

import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { relative } from "node:path";
import { findPlanForIssue, readPlan, readSpec, specPathFor, type Criterion } from "./spec.ts";
import { stateOf, type Change, type Issue } from "./tracker/tracker.ts";

export function taskIdsIn(text: string, issue: number): string[] {
  return [...text.matchAll(new RegExp(`\\bgh-${issue}/(t\\d+)\\b`, "g"))].map(m => m[1]);
}

export function refersTo(text: string, issue: Issue): boolean {
  return new RegExp(`(^|[^\\w/])#${issue.number}\\b`).test(text) || text.includes(issue.url) || taskIdsIn(text, issue.number).length > 0;
}

export type Decision =
  | { kind: "skip"; why: string }
  | { kind: "waiting"; left: string[] }
  | { kind: "done"; spec?: string; plan?: string; afterDeploy: Criterion[]; changes: Change[] };

export function decide(root: string, issue: Issue, merged: Change[]): Decision {
  const state = stateOf(issue);
  if (!issue.open) return { kind: "skip", why: `#${issue.number} is closed` };
  if (state !== "ready-for-agent" && state !== "ready-for-human")
    return { kind: "skip", why: `#${issue.number} is ${state ?? "unlabelled"}, not ready-for-agent or ready-for-human` };
  const changes = merged.filter(c => refersTo(`${c.title}\n${c.body}`, issue));
  if (!changes.length) return { kind: "skip", why: `no merged PR refers to #${issue.number}` };

  const planPath = findPlanForIssue(root, issue);
  if (!planPath) return { kind: "done", afterDeploy: [], changes }; // trivial: one task
  const plan = readPlan(planPath);
  const named = new Set(changes.flatMap(c => taskIdsIn(`${c.title}\n${c.body}`, issue.number)));
  const left = plan.tasks.filter(t => !t.done && !named.has(t.id)).map(t => t.id);
  if (left.length) return { kind: "waiting", left };
  const specPath = specPathFor(planPath);
  const afterDeploy = existsSync(specPath) ? readSpec(specPath).criteria.filter(c => c.afterDeploy) : [];
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
  if (built !== text) { writeFileSync(specFull, built); changed.push(d.spec); }
  if (d.plan && existsSync(`${root}/${d.plan}`)) { rmSync(`${root}/${d.plan}`); changed.push(d.plan); }
  return changed;
}

const links = (cs: Change[]) => cs.map(c => `#${c.number}`).join(", ");

export function closingComment(d: Extract<Decision, { kind: "done" }>, landed: string): string {
  const head = `Every task has merged (${links(d.changes)}).${d.spec ? ` ${landed}` : ""}`;
  if (!d.afterDeploy.length) return head;
  return `${head}\n\nThese criteria can only be checked in production, so this stays open as \`verifying\` until they pass:\n\n${d.afterDeploy.map(c => `- ${c.id}: ${c.text}`).join("\n")}`;
}
