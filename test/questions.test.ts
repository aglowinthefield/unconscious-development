import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChangeRequest, Note, Tracker } from "../src/tracker/tracker.ts";
import {
  answerQuestion, askQuestions, answerablePath, applyAnswer, mayAnswer, normaliseAnswer, parseQuestionTag, questionBody, questionsIn, unasked,
} from "../src/questions.ts";

const SPEC = `## Acceptance criteria

- AC1: Hashes differ in at most [NEEDS CLARIFICATION: bit cutoff; 31 proposed] of 256 bits.
- AC2: Quality at least [NEEDS CLARIFICATION: floor; 50 proposed].
`;

test("each marker becomes a question on its line", () => {
  assert.deepEqual(questionsIn("docs/specs/a/b.md", SPEC), [
    { path: "docs/specs/a/b.md", line: 3, marker: "[NEEDS CLARIFICATION: bit cutoff; 31 proposed]" },
    { path: "docs/specs/a/b.md", line: 4, marker: "[NEEDS CLARIFICATION: floor; 50 proposed]" },
  ]);
});

test("the comment body shows the question and carries a tag that finds the marker again", () => {
  const [q] = questionsIn("docs/specs/a/b.md", SPEC);
  const body = questionBody(q);
  assert.match(body, /^\*\*Open question:\*\* bit cutoff; 31 proposed\n/);
  assert.deepEqual(parseQuestionTag(body), { path: q.path, marker: q.marker });
  assert.equal(parseQuestionTag("a plain comment"), null);
  assert.equal(parseQuestionTag("<!-- ud-question !!! -->"), null);
});

test("a question already asked, or asked twice in one file, is posted once", () => {
  const qs = questionsIn("docs/specs/a/b.md", SPEC + SPEC.split("\n")[2] + "\n");
  assert.equal(qs.length, 3);
  assert.deepEqual(unasked(qs, []).map(q => q.line), [3, 4]);
  assert.deepEqual(unasked(qs, ["hi", questionBody(qs[0])]).map(q => q.line), [4]);
});

test("the answer replaces the marker as written, on one line", () => {
  const answer = normaliseAnswer("  31\r\n\r\n");
  assert.equal(answer, "31");
  const next = applyAnswer(SPEC, "[NEEDS CLARIFICATION: bit cutoff; 31 proposed]", answer);
  assert.match(next!, /- AC1: Hashes differ in at most 31 of 256 bits\./);
  assert.equal(questionsIn("x", next!).length, 1);
  assert.equal(normaliseAnswer("first line\nsecond line"), "first line second line");
  assert.equal(applyAnswer(SPEC, "[NEEDS CLARIFICATION: gone]", "x"), null);
});

test("only specs, plans and Personas can be edited", () => {
  assert.ok(answerablePath("docs/specs/a/b.md"));
  assert.ok(answerablePath("docs/specs/a/b.plan.md"));
  assert.ok(answerablePath("docs/personas/a.md"));
  assert.ok(!answerablePath("docs/specs/../../.github/workflows/x.md"));
  assert.ok(!answerablePath("src/cli.ts"));
  assert.ok(!answerablePath("docs/specs/a/b.ts"));
});

test("people with a stake answer, bots never; UD_SELF narrows it to named logins", () => {
  const tom = { login: "tom", bot: false, member: true };
  const drive = { login: "drive-by", bot: false, member: false };
  assert.ok(mayAnswer(tom));
  assert.ok(!mayAnswer(drive));
  assert.ok(!mayAnswer({ login: "x[bot]", bot: true, member: true }));
  assert.ok(mayAnswer(drive, ["drive-by"]));
  assert.ok(!mayAnswer(tom, ["zane"]));
});

// An in-memory tracker: one change request whose files live in a map, notes in an array.
function fakeTracker(files: Record<string, string>, branch = "spec/1") {
  const notes: Note[] = [];
  const cr: ChangeRequest = { number: 1, head: "abc", branch, files: Object.keys(files) };
  const tracker = {
    getChangeRequest: () => cr,
    fileAt: (path: string) => files[path] ?? null,
    notes: () => notes,
    getNote: (_: ChangeRequest, id: number) => notes.find(n => n.id === id)!,
    postNote: (_: ChangeRequest, n: { path: string; line: number; body: string }) =>
      void notes.push({ id: notes.length + 1, body: n.body, author: { login: "bot", bot: true, member: false } }),
    reply: (_: ChangeRequest, threadId: number, body: string) =>
      void notes.push({ id: notes.length + 1, body, author: { login: "bot", bot: true, member: false }, replyTo: threadId }),
  } as unknown as Tracker;
  return { tracker, notes };
}

test("ask posts each open question once, through any tracker", () => {
  const { tracker, notes } = fakeTracker({ "docs/specs/a/b.md": SPEC, "src/x.ts": "[NEEDS CLARIFICATION: not a spec]" });
  assert.equal(askQuestions(tracker, 1), 2);
  assert.equal(askQuestions(tracker, 1), 0);
  assert.deepEqual(notes.map(n => parseQuestionTag(n.body)?.marker), [
    "[NEEDS CLARIFICATION: bit cutoff; 31 proposed]",
    "[NEEDS CLARIFICATION: floor; 50 proposed]",
  ]);
});

test("a reply replaces its marker, is committed and pushed, and the thread hears back", () => {
  const dir = mkdtempSync(join(tmpdir(), "ud-answer-"));
  const remote = join(dir, "remote.git");
  const root = join(dir, "work");
  const sh = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  sh(dir, "init", "-q", "--bare", remote);
  sh(dir, "init", "-q", "-b", "spec/1", root);
  mkdirSync(join(root, "docs/specs/a"), { recursive: true });
  writeFileSync(join(root, "docs/specs/a/b.md"), SPEC);
  sh(root, "add", ".");
  sh(root, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "spec");
  sh(root, "remote", "add", "origin", remote);
  sh(root, "push", "-q", "origin", "spec/1");

  for (const k of ["GIT_AUTHOR", "GIT_COMMITTER"]) { process.env[`${k}_NAME`] = "ud"; process.env[`${k}_EMAIL`] = "ud@test"; }
  const { tracker, notes } = fakeTracker({ "docs/specs/a/b.md": SPEC });
  askQuestions(tracker, 1);
  notes.push({ id: 10, body: "31\n", author: { login: "tom", bot: false, member: true }, replyTo: 1 });
  notes.push({ id: 11, body: "50", author: { login: "drive-by", bot: false, member: false }, replyTo: 2 });

  assert.equal(answerQuestion(tracker, root, 1, 11, { self: [] }), "drive-by may not answer; ignored");
  assert.match(answerQuestion(tracker, root, 1, 10, { self: [] }), /^answered docs\/specs\/a\/b\.md in [0-9a-f]{7}$/);
  assert.match(readFileSync(join(root, "docs/specs/a/b.md"), "utf8"), /at most 31 of 256 bits/);
  assert.equal(sh(root, "rev-parse", "HEAD"), sh(remote, "rev-parse", "spec/1"));
  assert.match(notes.at(-1)!.body, /^Answered in [0-9a-f]{7}\. 1 open question left on this change\.$/);
  assert.equal(answerQuestion(tracker, root, 1, 10, { self: [] }), "marker already gone");
});
