import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { onMerge } from "../src/cli.ts";
import type { Runner } from "../src/runner/runner.ts";
import type { Issue, Tracker } from "../src/tracker/tracker.ts";
import { PERSONA, PLAN, SPEC, repo } from "./fixtures.ts";

// A merge that adds an approved spec and plan for #412, run against an issue in `labels`.
function merge(labels: string[]) {
  const git = (cwd: string, ...args: string[]) =>
    execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const root = repo({ "README.md": "x\n" });
  git(root, "init", "-q", "-b", "main");
  git(root, "config", "user.name", "t");
  git(root, "config", "user.email", "t@t");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "base");
  const base = git(root, "rev-parse", "HEAD");
  for (const [path, text] of Object.entries({
    "docs/personas/orders.md": PERSONA,
    "docs/specs/orders/bulk-archive.md": SPEC,
    "docs/specs/orders/bulk-archive.plan.md": PLAN,
  })) {
    execFileSync("sh", ["-c", `mkdir -p "$(dirname "$1")" && cat > "$1"`, "sh", path], { cwd: root, input: text });
  }
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "spec");
  const calls: string[] = [];
  const issue: Issue = {
    number: 412,
    url: "https://github.com/o/r/issues/412",
    title: "Bulk archive",
    body: "",
    labels,
    open: true,
  };
  const tracker = {
    getIssue: () => issue,
    setState: (i: Issue, s: string) => {
      calls.push(`state ${s}`);
      i.labels = [s];
    },
    comment: () => calls.push("comment"),
  } as unknown as Tracker;
  const runner: Runner = { name: "fake", createTask: (t) => (calls.push(`task ${t.key}`), t.key) };
  onMerge(root, tracker, runner, base, "HEAD");
  return calls;
}

test("on-merge flips an approved spec's issue and creates its tasks", () => {
  assert.deepEqual(merge([]), ["state ready-for-agent", "comment", "task gh-412/t1", "task gh-412/t2"]);
});

test("a rerun after a run that failed partway creates the tasks again instead of skipping", () => {
  assert.deepEqual(merge(["ready-for-agent"]), ["task gh-412/t1", "task gh-412/t2"]);
});

test("an issue already verifying is left alone", () => {
  assert.deepEqual(merge(["verifying"]), []);
});
