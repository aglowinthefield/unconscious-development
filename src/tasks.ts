import { relative } from "node:path";
import { parseDoc, section } from "./markdown.ts";
import { parseCriteria, readPersona, readPlan, readSpec, specPathFor, taskOrder, type Criterion } from "./spec.ts";
import type { Issue } from "./tracker/tracker.ts";
import type { TaskInput } from "./runner/runner.ts";

export const taskKey = (issue: number, task: string) => `gh-${issue}/${task}`;

function title(key: string, text: string) {
  const first = text.split(/(?<=\.)\s/)[0].replace(/\.$/, "");
  return `${key}: ${first.length > 90 ? first.slice(0, 89) + "…" : first}`;
}

const criteriaList = (cs: Criterion[]) => cs.map(c => `- ${c.id}: ${c.text}`).join("\n");

function invariantLines(invs: { id: string; verdict: string }[]) {
  const holds = invs.filter(i => /^holds/i.test(i.verdict)).map(i => i.id);
  const exceptions = invs.filter(i => !/^holds/i.test(i.verdict)).map(i => `- ${i.id}: ${i.verdict}`);
  return [holds.length ? `These hold, and the Shadow checks each against the diff: ${holds.join(", ")}.` : "", ...exceptions]
    .filter(Boolean).join("\n");
}

const closing = (issue: Issue, key: string) =>
  `Before you report, summon a Shadow with the criteria above and attach its verdicts. ` +
  `The PR's title starts with \`${key}\` and its body says \`Refs #${issue.number}\`, never \`Closes\`; ` +
  `that is how the merge job knows this task is done.`;

// Designed tier: one task per unchecked plan task.
export function tasksFromPlan(root: string, planPath: string, issue: Issue): { tasks: TaskInput[]; skipped: string[] } {
  const plan = readPlan(planPath);
  const spec = readSpec(specPathFor(planPath));
  const persona = readPersona(root, spec.domain);
  const byId = new Map(spec.criteria.map(c => [c.id, c]));
  const skipped = plan.tasks.filter(t => t.done).map(t => t.id);
  const tasks = taskOrder(plan.tasks.filter(t => !t.done)).map(t => {
    const key = taskKey(issue.number, t.id);
    const body = [
      `Refs ${issue.url}`,
      "",
      `Persona: \`${persona ? relative(root, persona.path) : `docs/personas/${spec.domain}.md`}\`. Read it first.`,
      `Spec: \`${relative(root, spec.path)}\`. Plan: \`${relative(root, planPath)}\`, task ${t.id}.`,
      "",
      "## Task",
      "",
      t.text + ".",
      "",
      "## Criteria",
      "",
      criteriaList(t.criteria.map(id => byId.get(id)!).filter(Boolean)),
      "",
      "## Setup note",
      "",
      spec.setupNote || "none",
      "",
      "## Invariants",
      "",
      invariantLines(plan.invariants),
      "",
      closing(issue, key),
    ].join("\n");
    return { key, title: title(key, t.text), body, after: t.after.filter(a => /^t\d+$/.test(a) && !skipped.includes(a)).map(a => taskKey(issue.number, a)) };
  });
  return { tasks, skipped };
}

// Trivial tier: the issue is the spec, and it is one task.
export function taskFromIssue(issue: Issue): TaskInput {
  const criteria = parseCriteria(section(parseDoc(issue.body), "Acceptance criteria")?.body ?? "");
  const key = taskKey(issue.number, "t1");
  const body = [
    `Refs ${issue.url}`,
    "",
    "## Task",
    "",
    issue.title,
    "",
    "## Criteria",
    "",
    criteriaList(criteria),
    "",
    closing(issue, key),
  ].join("\n");
  return { key, title: `${key}: ${issue.title}`, body, after: [] };
}
