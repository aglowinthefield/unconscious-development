import { test } from "node:test";
import assert from "node:assert/strict";
import { checksOf, firstProposal, prStage, renderPage, renderProjects, replaceSection, type PR, type Snapshot } from "../src/status.ts";

const at = "2026-11-15T15:00:00.000Z";
const pr = (over: Partial<PR>): PR => ({
  number: 1, url: "https://github.com/o/r/pull/1", title: "t", draft: false, createdAt: "2026-11-13T00:00:00Z",
  review: "", mergeable: "CLEAN", checks: "green", autoMerge: false, ...over,
});
const snap = (over: Partial<Snapshot> = {}): Snapshot => ({
  repo: "o/r", at, mine: [], reviewRequested: [], issues: [], specs: [], limits: [],
  main: { workflow: "CI", conclusion: "success", status: "completed", at: "2026-11-15T14:00:00Z", url: "https://x/run" },
  ...over,
});

test("checks: any failure fails, else any pending is pending, skipped counts as green", () => {
  assert.equal(checksOf([]), "none");
  assert.equal(checksOf([{ status: "COMPLETED", conclusion: "SKIPPED" }, { status: "COMPLETED", conclusion: "SUCCESS" }]), "green");
  assert.equal(checksOf([{ status: "IN_PROGRESS" }, { status: "COMPLETED", conclusion: "SUCCESS" }]), "pending");
  assert.equal(checksOf([{ status: "IN_PROGRESS" }, { __typename: "StatusContext", state: "FAILURE" }]), "failing");
});

test("a PR is stuck, yours, or waiting", () => {
  assert.equal(prStage(pr({ checks: "failing" })), "stuck");
  assert.equal(prStage(pr({ mergeable: "DIRTY" })), "stuck");
  assert.equal(prStage(pr({ checks: "pending" })), "waiting");
  assert.equal(prStage(pr({ draft: true })), "waiting");
  assert.equal(prStage(pr({})), "yours");
});

test("the page replaces owned sections and keeps the rest", () => {
  const previous = "---\nrepo: o/r\nupdated: old\n---\n\n## Stuck\n\nold\n\n## Proposed next\n\n- spec #9 next\n";
  const page = renderPage(previous, snap({ mine: [pr({ checks: "failing" }), pr({ number: 2, url: "https://github.com/o/r/pull/2", review: "APPROVED" })] }));
  assert.match(page, /^---\nrepo: o\/r\nupdated: 2026-11-15T15:00:00Z\n---\n/);
  assert.match(page, /## Stuck\n\n- https:\/\/github.com\/o\/r\/pull\/1 \(2d\): checks failing\n/);
  assert.match(page, /## Waiting on you\n\n- https:\/\/github.com\/o\/r\/pull\/2 \(2d\): approved, green: merge it\n/);
  assert.match(page, /## Proposed next\n\n- spec #9 next\n/);
  assert.ok(page.indexOf("## Proposed next") > page.indexOf("## Ready"));
  assert.ok(page.indexOf("## Proposed next") < page.indexOf("## Last updated"));
  assert.doesNotMatch(page, /\nold\n/);
  assert.equal(renderPage(page, snap()).match(/## Proposed next/g)?.length, 1);
});

test("a red main is stuck, and specs show task progress", () => {
  const page = renderPage("", snap({
    main: { workflow: "CI", conclusion: "failure", status: "completed", at: "2026-11-14T09:00:00Z", url: "https://x/run" },
    specs: [{ path: "docs/specs/a/b.md", issues: ["https://github.com/o/r/issues/4"], done: 1, total: 3 }],
  }));
  assert.match(page, /## Stuck\n\n- Main: CI failure at 2026-11-14 09:00Z/);
  assert.match(page, /- `docs\/specs\/a\/b.md`: 1 of 3 tasks done, https:\/\/github.com\/o\/r\/issues\/4/);
});

test("the index table counts per project, and only its section is replaced", () => {
  const table = renderProjects([
    { name: "Silk", file: "silk.md", snapshot: snap({ mine: [pr({ checks: "failing" })] }) },
    { name: "Mu", file: "mu.md", snapshot: null, error: "HTTP 404" },
  ]);
  assert.match(table, /\| \[\[silk\\\|Silk\]\] \|  \| 1 \|  \| green \| run `propose` \|/);
  assert.match(table, /\| \[\[mu\\\|Mu\]\] \| \| \| \| not read: HTTP 404 \|/);
  const index = "## This session\n\nmine\n\n## Projects\n\nold table\n\n## Notes\n\nkeep\n";
  assert.equal(replaceSection(index, "Projects", "new"), "## This session\n\nmine\n\n## Projects\n\nnew\n\n## Notes\n\nkeep\n");
  assert.equal(replaceSection("## A\n\nx\n", "Projects", "new"), "## A\n\nx\n\n## Projects\n\nnew\n");
});

test("the index shows each page's first proposal, short and table-safe", () => {
  const page = "## Proposed next\n\n2026-11-15, by the Magician.\n\n1. https://github.com/o/r/issues/6680, ingestion-search, trivial: `safety.ts` prices Gemini at retired rates, so the ledger is short. Constants only.\n2. other\n";
  assert.equal(firstProposal(page), "[#6680](https://github.com/o/r/issues/6680): `safety.ts` prices Gemini at retired rates, so the ledger is short");
  assert.equal(firstProposal("## Proposed next\n\n1. [[Token sources]], designed: tokens | sources.\n"), "[[Token sources]]: tokens \\| sources");
  assert.equal(firstProposal("## Ready\n\nx\n"), undefined);
  const table = renderProjects([{ name: "Silk", file: "silk.md", snapshot: snap(), next: firstProposal(page) }]);
  assert.match(table, /\| green \| \[#6680\]/);
});
