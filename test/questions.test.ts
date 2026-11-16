import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CARDS, card, drawCard } from "../src/cards.ts";
import { render } from "../src/comments.ts";
import type { ChangeRequest, Note, Tracker } from "../src/tracker/tracker.ts";
import {
  pollChangeRequest, pollQuestions, replyTag, answerablePath, applyAnswer, mayAnswer, normaliseAnswer, parseQuestionTag, questionBody, questionsIn, unasked,
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
  const body = questionBody(q, { self: [], rng: () => 0 });
  assert.match(body, /<img align="left" width="68" height="120" src="[^"]+\/tarot\/ace-of-cups\.png" alt="Ace of Cups">/);
  assert.match(body, /\*\*Open question:\*\* bit cutoff; 31 proposed\n/);
  assert.deepEqual(parseQuestionTag(body), { path: q.path, marker: q.marker });
  assert.equal(parseQuestionTag("a plain comment"), null);
  assert.equal(parseQuestionTag("<!-- ud-question !!! -->"), null);
});

test("the deck has 78 cards with readable names, drawn at random", () => {
  assert.equal(CARDS.length, 78);
  assert.equal(new Set(CARDS).size, 78);
  assert.equal(card("the-high-priestess").name, "The High Priestess");
  assert.equal(card("ace-of-pentacles").name, "Ace of Pentacles");
  assert.equal(drawCard(() => 0.999).slug, CARDS[77]);
});

test("a template fills its variables, and a custom one overrides the shipped one", () => {
  assert.equal(render("{{a}} and {{ b }} and {{nope}}.", { a: 1, b: "two" }), "1 and two and .");
  const dir = mkdtempSync(join(tmpdir(), "ud-tpl-"));
  writeFileSync(join(dir, "question.md"), "Q: {{question}} ({{card_name}})");
  const [q] = questionsIn("docs/specs/a/b.md", SPEC);
  const body = questionBody(q, { self: [], rng: () => 0, templates: [dir] });
  assert.equal(body.split("\n")[0], "Q: bit cutoff; 31 proposed (Ace of Cups)");
  assert.ok(parseQuestionTag(body), "the tag survives a custom template");
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

// An in-memory tracker: change requests whose branch files live in a map, notes in an array.
function fakeTracker(files: Record<string, string>) {
  const notes: Note[] = [];
  const commits: string[] = [];
  const cr: ChangeRequest = { number: 1, head: "c0", branch: "spec/1", files: Object.keys(files) };
  const me = { login: "tom", bot: false, member: true };
  const tracker = {
    getChangeRequest: () => cr,
    openChangeRequests: () => [cr, { number: 2, head: "x", branch: "y", files: ["src/x.ts"] }],
    fileAt: (path: string) => files[path] ?? null,
    commitFile: (_: ChangeRequest, f: { path: string; content: string; message: string }) => {
      files[f.path] = f.content;
      commits.push(f.message);
      return `c${commits.length}abcdef`;
    },
    notes: () => notes.map(n => ({ ...n })),
    getNote: (_: ChangeRequest, id: number) => notes.find(n => n.id === id)!,
    postNote: (_: ChangeRequest, n: { body: string }) => void notes.push({ id: notes.length + 1, body: n.body, author: me }),
    reply: (_: ChangeRequest, threadId: number, body: string) =>
      void notes.push({ id: notes.length + 1, body, author: me, replyTo: threadId }),
  } as unknown as Tracker;
  return { tracker, notes, files, commits, cr, me };
}

const opts = { self: [], rng: () => 0 };

test("a poll asks each open question once, on spec change requests only", () => {
  const { tracker, notes } = fakeTracker({ "docs/specs/a/b.md": SPEC, "src/x.ts": "[NEEDS CLARIFICATION: not a spec]" });
  assert.equal(pollQuestions(tracker, opts).length, 2);
  assert.deepEqual(pollQuestions(tracker, opts), []);
  assert.deepEqual(notes.map(n => parseQuestionTag(n.body)?.marker), [
    "[NEEDS CLARIFICATION: bit cutoff; 31 proposed]",
    "[NEEDS CLARIFICATION: floor; 50 proposed]",
  ]);
});

test("a reply replaces its marker in a commit, the thread hears back, and the next poll leaves it alone", () => {
  const { tracker, notes, files, commits, cr, me } = fakeTracker({ "docs/specs/a/b.md": SPEC });
  pollChangeRequest(tracker, cr, opts);
  notes.push({ id: 10, body: "31\n", author: me, replyTo: 1 });
  notes.push({ id: 11, body: "50", author: { login: "drive-by", bot: false, member: false }, replyTo: 2 });

  assert.deepEqual(pollChangeRequest(tracker, cr, { ...opts, dryRun: true }),
    ["#1 docs/specs/a/b.md: would answer [NEEDS CLARIFICATION: bit cutoff; 31 proposed] with: 31"]);
  assert.equal(commits.length, 0);

  assert.deepEqual(pollChangeRequest(tracker, cr, opts), ["#1 docs/specs/a/b.md: answered in c1abcde"]);
  assert.match(files["docs/specs/a/b.md"], /at most 31 of 256 bits/);
  assert.match(files["docs/specs/a/b.md"], /\[NEEDS CLARIFICATION: floor/, "the drive-by reply changed nothing");
  assert.match(commits[0], /^Answer an open question in docs\/specs\/a\/b\.md\n[\s\S]*Answered by @tom\.$/);
  const answered = notes.at(-1)!;
  assert.equal(answered.replyTo, 1);
  assert.ok(answered.body.endsWith(replyTag(10)));
  assert.match(answered.body, /Answered in c1abcde: 31\n\n1 open question left on this change\./);
  assert.equal(cr.head, "c1abcdef");

  notes.push({ id: 20, body: "actually 30", author: me, replyTo: 1 });
  assert.deepEqual(pollChangeRequest(tracker, cr, opts), [], "a settled thread takes no more answers");
  assert.equal(commits.length, 1);
});

test("a reply to a question no longer in the file is told so", () => {
  const { tracker, notes, files, cr, me } = fakeTracker({ "docs/specs/a/b.md": SPEC });
  pollChangeRequest(tracker, cr, opts);
  files["docs/specs/a/b.md"] = SPEC.replace("[NEEDS CLARIFICATION: bit cutoff; 31 proposed]", "31");
  notes.push({ id: 10, body: "31", author: me, replyTo: 1 });
  assert.deepEqual(pollChangeRequest(tracker, cr, opts), ["#1 docs/specs/a/b.md: question already gone"]);
  assert.match(notes.at(-1)!.body, /no longer in the file/);
  assert.deepEqual(pollChangeRequest(tracker, cr, opts), []);
});
