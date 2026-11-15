import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { checkFiles, checkIssueBody, findPlanForIssue, parseTasks, specFiles, taskOrder } from "../src/spec.ts";
import { taskFromIssue, tasksFromPlan } from "../src/tasks.ts";
import type { Issue } from "../src/tracker/tracker.ts";

const PERSONA = `---
domain: orders
status: confirmed
---

## Scope

Orders.

## Invariants

| Id | Rule | Sources |
| --- | --- | --- |
| I1 | One. | x |
| I2 | Two. | y |
`;

const SPEC = `---
domain: orders
status: approved
issues:
  - https://github.com/o/r/issues/412
surfaces:
  - web
---

## Goal

Archive many orders at once.

## Non-goals

- Undo.

## Acceptance criteria

- AC1: Selecting 30 orders and archiving leaves 20 in the list.
- AC2: More than 500 ids is refused with a 400.
- AC3 (after deploy): Archive errors stay under 1 per day for a week.

## Setup note

Seed 50 orders.

## Surfaces touched

- Web

## Cost and scale

none
`;

const PLAN = `---
issue: https://github.com/o/r/issues/412
budget_usd: 5
---

## Approach

One mutation.

## Data model and contracts

none

## Invariants

- orders/I1: holds
- orders/I2: exception: the bulk path skips the audit hook; approved in review

## Tasks

- [ ] t1: Add the bulk archive mutation with a 500-id limit. Criteria: AC2
- [ ] t2: Add selection and the archive button to the orders list.
      Criteria: AC1. after: t1
`;

function repo(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "ud-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const base = (over: Record<string, string> = {}) =>
  repo({
    "docs/personas/orders.md": PERSONA,
    "docs/specs/orders/bulk-archive.md": SPEC,
    "docs/specs/orders/bulk-archive.plan.md": PLAN,
    ...over,
  });

const messages = (root: string) => checkFiles(root, specFiles(root)).map(p => p.message);

test("a well-formed spec and plan pass", () => {
  assert.deepEqual(messages(base()), []);
});

test("a spec without criteria, sections or ids fails", () => {
  const spec = SPEC.replace(/- AC1: .*\n- AC2: .*\n- AC3.*\n/, "- Archiving works.\n").replace("## Cost and scale\n\nnone\n", "");
  const m = messages(base({ "docs/specs/orders/bulk-archive.md": spec, "docs/specs/orders/bulk-archive.plan.md": "" }));
  assert.ok(m.includes('missing section "## Cost and scale"'));
  assert.ok(m.includes("no acceptance criteria; write each as `- AC1: <claim>`"));
  assert.ok(m.some(x => x.startsWith("criterion without an id")));
});

test("an open question blocks", () => {
  const m = messages(base({ "docs/specs/orders/bulk-archive.md": SPEC.replace("Undo.", "Undo. [NEEDS CLARIFICATION: soft delete?]") }));
  assert.deepEqual(m, ["open question: [NEEDS CLARIFICATION: soft delete?]"]);
});

test("every Persona invariant must be in the plan", () => {
  const m = messages(base({ "docs/specs/orders/bulk-archive.plan.md": PLAN.replace("- orders/I1: holds\n", "") }));
  assert.deepEqual(m, ["invariant orders/I1 missing from \"## Invariants\""]);
});

test("a draft Persona can't carry a plan", () => {
  const m = messages(base({ "docs/personas/orders.md": PERSONA.replace("confirmed", "draft") }));
  assert.deepEqual(m, ["Persona docs/personas/orders.md is draft; plans need confirmed invariants"]);
});

test("criteria coverage skips after-deploy ones, and tasks can't claim them", () => {
  assert.deepEqual(messages(base({ "docs/specs/orders/bulk-archive.plan.md": PLAN.replace("Criteria: AC2", "Criteria: AC3") })), [
    "t1 names AC3, an after-deploy criterion; no task makes those true",
    "AC2 isn't covered by any task",
  ]);
});

test("unknown dependencies and cycles fail", () => {
  const cyc = PLAN.replace("Criteria: AC2", "Criteria: AC2. after: t2");
  assert.deepEqual(messages(base({ "docs/specs/orders/bulk-archive.plan.md": cyc })), ["tasks wait on each other: t1 → t2 → t1"]);
  const unknown = PLAN.replace("after: t1", "after: t9");
  assert.deepEqual(messages(base({ "docs/specs/orders/bulk-archive.plan.md": unknown })), ["t2 is after t9, which isn't a task"]);
});

test("an approved spec needs its plan; a built one doesn't", () => {
  const root = repo({ "docs/personas/orders.md": PERSONA, "docs/specs/orders/bulk-archive.md": SPEC });
  assert.deepEqual(messages(root), ["approved spec has no plan at docs/specs/orders/bulk-archive.plan.md"]);
  const built = repo({ "docs/personas/orders.md": PERSONA, "docs/specs/orders/bulk-archive.md": SPEC.replace("approved", "built") });
  assert.deepEqual(messages(built), []);
});

test("task lines parse across continuation lines, in dependency order", () => {
  const tasks = parseTasks("- [ ] t2: Second.\n  Criteria: AC1. after: t1\n- [x] t1: First. Criteria: AC2, AC3\n");
  assert.deepEqual(tasks.map(t => [t.id, t.done, t.criteria, t.after]), [["t2", false, ["AC1"], ["t1"]], ["t1", true, ["AC2", "AC3"], []]]);
  assert.deepEqual(taskOrder(tasks).map(t => t.id), ["t1", "t2"]);
});

const issue: Issue = { number: 412, url: "https://github.com/o/r/issues/412", title: "Bulk archive", body: "", labels: ["ready-for-agent"], open: true };

test("spec-to-tasks builds one keyed task per plan task", () => {
  const root = base();
  const plan = findPlanForIssue(root, issue)!;
  const { tasks } = tasksFromPlan(root, plan, issue);
  assert.deepEqual(tasks.map(t => [t.key, t.after]), [["gh-412/t1", []], ["gh-412/t2", ["gh-412/t1"]]]);
  assert.match(tasks[0].body, /Persona: `docs\/personas\/orders.md`/);
  assert.match(tasks[0].body, /- AC2: More than 500 ids/);
  assert.doesNotMatch(tasks[0].body, /AC1:/);
  assert.match(tasks[0].body, /orders\/I2: exception: the bulk path/);
  assert.match(tasks[0].body, /Refs #412`, never `Closes`/);
});

test("trivial issues carry their criteria in the body", () => {
  assert.deepEqual(checkIssueBody("#9", "Fix the typo.\n\n## Acceptance criteria\n\n- AC1: The footer says Silk.\n"), []);
  assert.deepEqual(checkIssueBody("#9", "Fix the typo.").map(p => p.message), ['issue body has no "## Acceptance criteria"']);
  const t = taskFromIssue({ ...issue, body: "## Acceptance criteria\n\n- AC1: The footer says Silk.\n" });
  assert.equal(t.key, "gh-412/t1");
  assert.match(t.body, /- AC1: The footer says Silk\./);
});
