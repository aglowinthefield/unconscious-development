import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { builtChange, closingComment, decide, markBuilt, refersTo, taskIdsIn, taskMerged } from "../src/task-merged.ts";
import type { Change, Issue, Tracker } from "../src/tracker/tracker.ts";
import { PLAN, SPEC, repo } from "./fixtures.ts";

const issue = (over: Partial<Issue> = {}): Issue => ({
  number: 412,
  url: "https://github.com/o/r/issues/412",
  title: "Bulk archive",
  body: "",
  labels: ["ready-for-agent"],
  open: true,
  ...over,
});
const pr = (number: number, title: string, body = "Refs #412"): Change => ({
  number,
  url: `u/${number}`,
  title,
  body,
  merged: true,
});
const files = (plan = PLAN) =>
  repo({ "docs/specs/orders/bulk-archive.md": SPEC, "docs/specs/orders/bulk-archive.plan.md": plan });

test("a PR names its task by key and its issue by number or URL", () => {
  assert.deepEqual(taskIdsIn("gh-412/t1: mutation; also gh-41/t9 and gh-412/t2", 412), ["t1", "t2"]);
  assert.ok(refersTo("Refs #412", issue()));
  assert.ok(refersTo("Refs https://github.com/o/r/issues/412", issue()));
  assert.ok(!refersTo("Refs #4123 and o/r#412x", issue()));
});

test("the change waits until every task has a merged PR, counting ticked boxes", () => {
  const root = files();
  assert.deepEqual(decide(root, issue(), [pr(1, "gh-412/t1: mutation")]), { kind: "waiting", left: ["t2"] });
  assert.equal(
    decide(root, issue(), [pr(1, "gh-412/t1: mutation"), pr(2, "Selection", "gh-412/t2\nRefs #412")]).kind,
    "done",
  );
  const ticked = files(PLAN.replace("- [ ] t1", "- [x] t1"));
  assert.equal(decide(ticked, issue(), [pr(2, "gh-412/t2: selection")]).kind, "done");
});

test("a plan's task needs its key, since the spec PR also refers to the issue; a trivial issue doesn't", () => {
  const one = files(PLAN.replace(/- \[ \] t2:[^]*$/, ""));
  assert.deepEqual(decide(one, issue(), [pr(1, "docs(specs): spec bulk archive")]), { kind: "waiting", left: ["t1"] });
  assert.equal(
    decide(one, issue(), [pr(1, "docs(specs): spec bulk archive"), pr(2, "gh-412/t1: bulk archive")]).kind,
    "done",
  );
  const trivial = repo({});
  assert.deepEqual(decide(trivial, issue(), [pr(1, "Fix copy")]), {
    kind: "done",
    afterDeploy: [],
    changes: [pr(1, "Fix copy")],
  });
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
  assert.deepEqual(
    d.afterDeploy.map((c) => c.id),
    ["AC3"],
  );
  assert.deepEqual(markBuilt(root, d), ["docs/specs/orders/bulk-archive.md", "docs/specs/orders/bulk-archive.plan.md"]);
  assert.match(readFileSync(join(root, "docs/specs/orders/bulk-archive.md"), "utf8"), /^status: built$/m);
  assert.ok(!existsSync(join(root, "docs/specs/orders/bulk-archive.plan.md")));
  assert.deepEqual(markBuilt(root, d), [], "running it again changes nothing");
  const comment = closingComment(d, "Landed in abc1234.");
  assert.match(
    comment,
    /^Every task has merged \(#1, #2\)\. Landed in abc1234\.\n\n.*`verifying`.*\n\n- AC3: Archive errors/,
  );
});

test("the furthest-along state label wins, so adding ready-for-agent approves", async () => {
  const { stateOf } = await import("../src/tracker/tracker.ts");
  assert.equal(stateOf(issue({ labels: ["needs-spec", "ready-for-agent"] })), "ready-for-agent");
  assert.equal(stateOf(issue({ labels: ["ready-for-agent", "verifying"] })), "verifying");
  assert.equal(stateOf(issue({ labels: ["bug"] })), null);
});

test("the built PR gets a conventional title and the repo's required sections", () => {
  const root = files();
  const d = decide(root, issue(), [pr(1, "gh-412/t1"), pr(2, "gh-412/t2")]);
  if (d.kind !== "done") throw new Error("expected done");
  const { title, body } = builtChange(d, issue(), { tail: "## Staging QA\n\nNo manual step.\n" });
  assert.equal(title, "docs(orders): mark the bulk-archive spec built");
  assert.equal(
    body,
    "Marks `docs/specs/orders/bulk-archive.md` built and removes its plan: every task of #412 has merged (#1, #2).\n\nRefs #412\n\n## Staging QA\n\nNo manual step.",
  );
  assert.equal(
    builtChange(d, issue(), { template: "chore: {name} ({domain}) built" }).title,
    "chore: bulk-archive (orders) built",
  );
});

// A project repo with an origin to push to, and a tracker that records what it was asked to do.
function project(spec = SPEC) {
  const git = (cwd: string, ...args: string[]) =>
    execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const origin = mkdtempSync(join(tmpdir(), "ud-origin-"));
  git(origin, "init", "-q", "--bare", "-b", "main");
  const root = repo({ "docs/specs/orders/bulk-archive.md": spec, "docs/specs/orders/bulk-archive.plan.md": PLAN });
  git(root, "init", "-q", "-b", "main");
  git(root, "config", "user.name", "t");
  git(root, "config", "user.email", "t@t");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "spec");
  git(root, "remote", "add", "origin", origin);
  git(root, "push", "-q", "origin", "main");
  const calls: string[] = [];
  const it = issue();
  const tracker = {
    getIssue: () => it,
    mergedChangesFor: () => [pr(1, "gh-412/t1"), pr(2, "gh-412/t2")],
    setState: (_: Issue, s: string) => {
      calls.push(`state ${s}`);
    },
    comment: (_: Issue, body: string) => {
      calls.push(`comment ${body.split("\n")[0]}`);
    },
    close: () => {
      calls.push("close");
    },
    openChange: (c: { branch: string; base: string; title: string }) => {
      calls.push(`pr ${c.branch} -> ${c.base}: ${c.title}`);
      return "https://x/pull/9";
    },
  } as unknown as Tracker;
  return { root, origin, git, calls, tracker };
}

test("--via-pr lands the spec change on a side branch and a PR, leaving the checkout alone", () => {
  const { root, origin, git, calls, tracker } = project();
  const head = git(root, "rev-parse", "HEAD");
  taskMerged(root, tracker, [pr(2, "gh-412/t2")], { viaPr: true });
  assert.equal(git(root, "rev-parse", "HEAD"), head, "the checkout's HEAD doesn't move");
  assert.equal(git(root, "status", "--porcelain"), "", "nor does its working tree");
  assert.match(git(origin, "show", "ud/built-412:docs/specs/orders/bulk-archive.md"), /^status: built$/m);
  assert.equal(
    git(origin, "ls-tree", "--name-only", "ud/built-412", "docs/specs/orders/"),
    "docs/specs/orders/bulk-archive.md",
  );
  assert.equal(git(origin, "rev-parse", "main"), head, "main is untouched");
  assert.equal(git(root, "worktree", "list").split("\n").length, 1, "the scratch worktree is gone");
  assert.deepEqual(calls, [
    "pr ud/built-412 -> main: docs(orders): mark the bulk-archive spec built",
    "state verifying",
    "comment Every task has merged (#2, #1). Marking the spec `built` is in https://x/pull/9.",
  ]);
});

test("without --via-pr, a refused push falls back to the same PR", () => {
  const { root, origin, git, calls, tracker } = project();
  // A hook that refuses every push to main, as a protected branch does.
  execFileSync(
    "sh",
    [
      "-c",
      `printf '#!/bin/sh\nwhile read o n r; do [ "$r" = refs/heads/main ] && exit 1; done; exit 0\n' > hooks/pre-receive && chmod +x hooks/pre-receive`,
    ],
    { cwd: origin },
  );
  taskMerged(root, tracker, [pr(2, "gh-412/t2")], {});
  assert.match(git(origin, "show", "ud/built-412:docs/specs/orders/bulk-archive.md"), /^status: built$/m);
  assert.equal(calls[0], "pr ud/built-412 -> main: docs(orders): mark the bulk-archive spec built");
  assert.match(
    calls[2],
    /^comment .*main refused a direct push, so marking the spec `built` is in https:\/\/x\/pull\/9\.$/,
  );
});

test("a closing comment that fails doesn't stop the issue closing", () => {
  const { root, calls, tracker } = project(SPEC.replace(/- AC3 \(after deploy\).*\n/, ""));
  tracker.comment = () => {
    throw new Error("gh: HTTP 502");
  };
  taskMerged(root, tracker, [pr(2, "gh-412/t2")], {});
  assert.equal(calls.at(-1), "close");
});
