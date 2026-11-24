import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { doNextUrls, dueProjects } from "../src/propose-due.ts";

const page = (doNext: string) => `---
repo: o/r
---

## Proposed next

2026-11-24, by the Magician.

> [!tip] Do next: ${doNext}
> Stops ongoing damage. Trivial, ~$10.

Fix
- https://github.com/o/r/issues/9: not the top pick.
`;

const setup = (pages: Record<string, string>) => {
  const dir = mkdtempSync(join(tmpdir(), "now-"));
  for (const [name, text] of Object.entries(pages)) writeFileSync(join(dir, `${name}.md`), text);
  return { dir, state: join(dir, ".state/propose-due.json") };
};

test("Do next URLs come from the callout line only", () => {
  assert.deepEqual(doNextUrls(page("https://github.com/o/r/issues/1, https://github.com/o/r/pull/2")), [
    "https://github.com/o/r/issues/1",
    "https://github.com/o/r/pull/2",
  ]);
  assert.deepEqual(doNextUrls("## Proposed next\n\n1. https://github.com/o/r/issues/3\n"), []);
});

test("a project is due once every Do next item is closed, and fires once", () => {
  const { dir, state } = setup({
    silk: page("https://github.com/o/r/issues/1"),
    mu: page("https://github.com/o/r/issues/2 https://github.com/o/r/issues/3"),
    notes: "---\ntitle: x\n---\n\n## Proposed next\n\n> [!tip] Do next: https://github.com/o/r/issues/1\n",
  });
  const closed = new Set(["https://github.com/o/r/issues/1", "https://github.com/o/r/issues/2"]);
  const check = (u: string) => closed.has(u);

  assert.deepEqual(dueProjects(dir, state, check), ["silk"]); // mu still has #3 open; notes has no repo:
  assert.deepEqual(dueProjects(dir, state, check), []); // already fired
  assert.deepEqual(JSON.parse(readFileSync(state, "utf8")), { silk: "https://github.com/o/r/issues/1" });

  closed.add("https://github.com/o/r/issues/3");
  assert.deepEqual(dueProjects(dir, state, check), ["mu"]);

  writeFileSync(join(dir, "silk.md"), page("https://github.com/o/r/issues/4")); // a new pick
  closed.add("https://github.com/o/r/issues/4");
  assert.deepEqual(dueProjects(dir, state, check), ["silk"]);
});

test("a check that fails counts as not done", () => {
  const { dir, state } = setup({ silk: page("https://github.com/o/r/issues/1") });
  const boom = () => {
    throw new Error("offline");
  };
  assert.deepEqual(dueProjects(dir, state, boom), []);
  assert.deepEqual(
    dueProjects(dir, state, () => true),
    ["silk"],
  );
});
