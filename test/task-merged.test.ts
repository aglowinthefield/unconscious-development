import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { closingComment, decide, markBuilt, refersTo, taskIdsIn } from "../src/task-merged.ts";
import type { Change, Issue } from "../src/tracker/tracker.ts";
import { PLAN, SPEC, repo } from "./fixtures.ts";

const issue = (over: Partial<Issue> = {}): Issue =>
  ({ number: 412, url: "https://github.com/o/r/issues/412", title: "Bulk archive", body: "", labels: ["ready-for-agent"], open: true, ...over });
const pr = (number: number, title: string, body = "Refs #412"): Change => ({ number, url: `u/${number}`, title, body, merged: true });
const files = (plan = PLAN) => repo({ "docs/specs/orders/bulk-archive.md": SPEC, "docs/specs/orders/bulk-archive.plan.md": plan });

test("a PR names its task by key and its issue by number or URL", () => {
  assert.deepEqual(taskIdsIn("gh-412/t1: mutation; also gh-41/t9 and gh-412/t2", 412), ["t1", "t2"]);
  assert.ok(refersTo("Refs #412", issue()));
  assert.ok(refersTo("Refs https://github.com/o/r/issues/412", issue()));
  assert.ok(!refersTo("Refs #4123 and o/r#412x", issue()));
});

test("the change waits until every task has a merged PR, counting ticked boxes", () => {
  const root = files();
  assert.deepEqual(decide(root, issue(), [pr(1, "gh-412/t1: mutation")]), { kind: "waiting", left: ["t2"] });
  assert.equal(decide(root, issue(), [pr(1, "gh-412/t1: mutation"), pr(2, "Selection", "gh-412/t2\nRefs #412")]).kind, "done");
  const ticked = files(PLAN.replace("- [ ] t1", "- [x] t1"));
  assert.equal(decide(ticked, issue(), [pr(2, "gh-412/t2: selection")]).kind, "done");
});

test("a plan's task needs its key, since the spec PR also refers to the issue; a trivial issue doesn't", () => {
  const one = files(PLAN.replace(/- \[ \] t2:[^]*$/, ""));
  assert.deepEqual(decide(one, issue(), [pr(1, "docs(specs): spec bulk archive")]), { kind: "waiting", left: ["t1"] });
  assert.equal(decide(one, issue(), [pr(1, "docs(specs): spec bulk archive"), pr(2, "gh-412/t1: bulk archive")]).kind, "done");
  const trivial = repo({});
  assert.deepEqual(decide(trivial, issue(), [pr(1, "Fix copy")]), { kind: "done", afterDeploy: [], changes: [pr(1, "Fix copy")] });
  assert.equal(decide(trivial, issue(), [pr(1, "Fix copy", "unrelated")]).kind, "skip");
});

test("only open issues that were handed out are finished", () => {
  const root = files();
  assert.equal(decide(root, issue({ open: false }), [pr(1, "gh-412/t1")]).kind, "skip");
  assert.equal(decide(root, issue({ labels: ["needs-spec"] }), [pr(1, "gh-412/t1")]).kind, "skip");
});

test("done marks the spec built, removes the plan, and keeps after-deploy criteria open", () => {
  const root = files();
  const d = decide(root, issue(), [pr(1, "gh-412/t1"), pr(2, "gh-412/t2")]);
  assert.equal(d.kind, "done");
  if (d.kind !== "done") return;
  assert.deepEqual(d.afterDeploy.map(c => c.id), ["AC3"]);
  assert.deepEqual(markBuilt(root, d), ["docs/specs/orders/bulk-archive.md", "docs/specs/orders/bulk-archive.plan.md"]);
  assert.match(readFileSync(join(root, "docs/specs/orders/bulk-archive.md"), "utf8"), /^status: built$/m);
  assert.ok(!existsSync(join(root, "docs/specs/orders/bulk-archive.plan.md")));
  assert.deepEqual(markBuilt(root, d), [], "running it again changes nothing");
  const comment = closingComment(d, "Landed in abc1234.");
  assert.match(comment, /^Every task has merged \(#1, #2\)\. Landed in abc1234\.\n\n.*`verifying`.*\n\n- AC3: Archive errors/);
});

test("the furthest-along state label wins, so adding ready-for-agent approves", async () => {
  const { stateOf } = await import("../src/tracker/tracker.ts");
  assert.equal(stateOf(issue({ labels: ["needs-spec", "ready-for-agent"] })), "ready-for-agent");
  assert.equal(stateOf(issue({ labels: ["ready-for-agent", "verifying"] })), "verifying");
  assert.equal(stateOf(issue({ labels: ["bug"] })), null);
});
