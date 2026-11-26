import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkFiles,
  checkIssueBody,
  errorsIn,
  findPlanForIssue,
  parseTasks,
  specFiles,
  taskOrder,
} from "../src/spec.ts";
import { taskFromIssue, tasksFromPlan } from "../src/tasks.ts";
import type { Issue } from "../src/tracker/tracker.ts";
import { PERSONA, PLAN, SPEC, repo } from "./fixtures.ts";

const base = (over: Record<string, string> = {}) =>
  repo({
    "docs/personas/orders.md": PERSONA,
    "docs/specs/orders/bulk-archive.md": SPEC,
    "docs/specs/orders/bulk-archive.plan.md": PLAN,
    ...over,
  });

const messages = (root: string) => checkFiles(root, specFiles(root)).map((p) => p.message);

test("a well-formed spec and plan pass", () => {
  assert.deepEqual(messages(base()), []);
});

test("a spec without criteria, sections or ids fails", () => {
  const spec = SPEC.replace(/- AC1: .*\n- AC2: .*\n- AC3.*\n/, "- Archiving works.\n").replace(
    "## Cost and scale\n\nnone\n",
    "",
  );
  const m = messages(base({ "docs/specs/orders/bulk-archive.md": spec, "docs/specs/orders/bulk-archive.plan.md": "" }));
  assert.ok(m.includes('missing section "## Cost and scale"'));
  assert.ok(m.includes("no acceptance criteria; write each as `- AC1: <claim>`"));
  assert.ok(m.some((x) => x.startsWith("criterion without an id")));
});

test("an open question blocks", () => {
  const m = messages(
    base({ "docs/specs/orders/bulk-archive.md": SPEC.replace("Undo.", "Undo. [NEEDS CLARIFICATION: soft delete?]") }),
  );
  assert.deepEqual(m, ["open question: [NEEDS CLARIFICATION: soft delete?]"]);
});

test("two identical markers in one file are refused, since they'd share one question", () => {
  const m = messages(
    base({
      "docs/specs/orders/bulk-archive.md": SPEC.replace(
        "Undo.",
        "Undo. [NEEDS CLARIFICATION: ok?]\n- Export. [NEEDS CLARIFICATION: ok?]",
      ),
    }),
  );
  assert.ok(m.some((x) => /^same marker as line \d+; give each its own slot label/.test(x)));
});

test("every Persona invariant must be in the plan", () => {
  const m = messages(base({ "docs/specs/orders/bulk-archive.plan.md": PLAN.replace("- orders/I1: holds\n", "") }));
  assert.deepEqual(m, ['invariant orders/I1 missing from "## Invariants"']);
});

test("an invariant holds, with or without a note, or is an exception with a reason", () => {
  const plan = (v: string) =>
    messages(
      base({ "docs/specs/orders/bulk-archive.plan.md": PLAN.replace("- orders/I1: holds\n", `- orders/I1: ${v}\n`) }),
    );
  assert.deepEqual(plan("holds. Archive is a soft delete."), []);
  assert.deepEqual(plan("exception: the export runs nightly"), []);
  assert.deepEqual(plan("probably fine"), [
    'invariant orders/I1 must start `holds` or `exception: <reason>`; got "probably fine"',
  ]);
  assert.equal(plan("exception:").length, 1);
});

test("a draft Persona warns but doesn't block a plan", () => {
  const root = base({ "docs/personas/orders.md": PERSONA.replace("confirmed", "draft") });
  const problems = checkFiles(root, specFiles(root));
  assert.deepEqual(
    problems.map((p) => [p.message, p.warning]),
    [["Persona docs/personas/orders.md is draft; its invariants aren't settled yet, so check them in review", true]],
  );
  assert.deepEqual(errorsIn(problems), []);
});

test("criteria coverage skips after-deploy ones, and tasks can't claim them", () => {
  assert.deepEqual(
    messages(base({ "docs/specs/orders/bulk-archive.plan.md": PLAN.replace("Criteria: AC2", "Criteria: AC3") })),
    ["t1 names AC3, an after-deploy criterion; no task makes those true", "AC2 isn't covered by any task"],
  );
});

test("unknown dependencies and cycles fail", () => {
  const cyc = PLAN.replace("Criteria: AC2", "Criteria: AC2. after: t2");
  assert.deepEqual(messages(base({ "docs/specs/orders/bulk-archive.plan.md": cyc })), [
    "tasks wait on each other: t1 → t2 → t1",
  ]);
  const unknown = PLAN.replace("after: t1", "after: t9");
  assert.deepEqual(messages(base({ "docs/specs/orders/bulk-archive.plan.md": unknown })), [
    "t2 is after t9, which isn't a task",
  ]);
});

test("after: names task ids in this plan only", () => {
  const other = PLAN.replace("after: t1", "after: t1, billing checkout");
  assert.deepEqual(messages(base({ "docs/specs/orders/bulk-archive.plan.md": other })), [
    "t2 is after \"billing checkout\", which isn't a task id in this plan; `after:` names task ids only, so say a wait on other work in the task's text",
  ]);
});

test("two plans can't share an issue", () => {
  const second = SPEC.replace("bulk archive", "bulk restore");
  const m = messages(
    base({
      "docs/specs/orders/bulk-restore.md": second,
      "docs/specs/orders/bulk-restore.plan.md": PLAN.replace(
        "issue: https://github.com/o/r/issues/412",
        "issue: '#412'",
      ),
    }),
  );
  assert.deepEqual(m, [
    "plan issue https://github.com/o/r/issues/412 is also the issue of docs/specs/orders/bulk-restore.plan.md; give each spec its own issue",
    "plan issue #412 is also the issue of docs/specs/orders/bulk-archive.plan.md; give each spec its own issue",
    "plan issue #412 isn't in the spec's `issues`",
  ]);
});

test("an approved spec needs its plan; a built one doesn't", () => {
  const root = repo({ "docs/personas/orders.md": PERSONA, "docs/specs/orders/bulk-archive.md": SPEC });
  assert.deepEqual(messages(root), ["approved spec has no plan at docs/specs/orders/bulk-archive.plan.md"]);
  const built = repo({
    "docs/personas/orders.md": PERSONA,
    "docs/specs/orders/bulk-archive.md": SPEC.replace("approved", "built"),
  });
  assert.deepEqual(messages(built), []);
});

test("after: never reaches the task's text, wherever it sits", () => {
  const [first, last] = parseTasks(
    "- [ ] t2: after: t1. Add procedures. Criteria: AC1\n- [ ] t3: Move screens. Criteria: AC1. After: t2.\n",
  );
  assert.deepEqual([first.text, first.after], ["Add procedures", ["t1"]]);
  assert.deepEqual([last.text, last.after], ["Move screens", ["t2"]]);
  const [nested] = parseTasks("- [x] t4: Add the lane. Criteria: AC1. after: t3\n  - Done in `src/lane.ts`.\n");
  assert.deepEqual(nested.after, ["t3"]);
});

test("task lines parse across continuation lines, in dependency order", () => {
  const tasks = parseTasks("- [ ] t2: Second.\n  Criteria: AC1. after: t1\n- [x] t1: First. Criteria: AC2, AC3\n");
  assert.deepEqual(
    tasks.map((t) => [t.id, t.done, t.criteria, t.after]),
    [
      ["t2", false, ["AC1"], ["t1"]],
      ["t1", true, ["AC2", "AC3"], []],
    ],
  );
  assert.deepEqual(
    taskOrder(tasks).map((t) => t.id),
    ["t1", "t2"],
  );
});

const issue: Issue = {
  number: 412,
  url: "https://github.com/o/r/issues/412",
  title: "Bulk archive",
  body: "",
  labels: ["ready-for-agent"],
  open: true,
};

test("spec-to-tasks builds one keyed task per plan task", () => {
  const root = base();
  const plan = findPlanForIssue(root, issue)!;
  const { tasks } = tasksFromPlan(root, plan, issue);
  assert.deepEqual(
    tasks.map((t) => [t.key, t.after]),
    [
      ["gh-412/t1", []],
      ["gh-412/t2", ["gh-412/t1"]],
    ],
  );
  assert.match(tasks[0].body, /Persona: `docs\/personas\/orders.md`/);
  assert.match(tasks[0].body, /- AC2: More than 500 ids/);
  assert.doesNotMatch(tasks[0].body, /AC1:/);
  assert.match(tasks[0].body, /orders\/I2: exception: the bulk path/);
  assert.match(tasks[0].body, /Refs #412`, never `Closes`/);
});

test("trivial issues carry their criteria in the body", () => {
  assert.deepEqual(
    checkIssueBody("#9", "Fix the typo.\n\n## Acceptance criteria\n\n- AC1: The footer says Silk.\n"),
    [],
  );
  assert.deepEqual(
    checkIssueBody("#9", "Fix the typo.").map((p) => p.message),
    ['issue body has no "## Acceptance criteria"'],
  );
  const t = taskFromIssue({ ...issue, body: "## Acceptance criteria\n\n- AC1: The footer says Silk.\n" });
  assert.equal(t.key, "gh-412/t1");
  assert.match(t.body, /- AC1: The footer says Silk\./);
});
