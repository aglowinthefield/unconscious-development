import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CARDS, card, drawCard } from "../src/cards.ts";
import { render } from "../src/comments.ts";
import { fitSpan, literal, parseVerdict, prompt, type InterpretInput, type Interpreter, type Verdict } from "../src/interpret.ts";
import type { ChangeRequest, Note, Tracker } from "../src/tracker/tracker.ts";
import {
  pollChangeRequest, pollQuestions, parseReplyTag, answerablePath, mayAnswer, normaliseAnswer, parseQuestionTag, questionBody, questionTag, questionsIn, unasked,
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
  const body = questionBody(q, { rng: () => 0 });
  assert.match(body, /<img align="left" width="68" height="120" src="[^"]+\/tarot\/ace-of-cups\.png" alt="Ace of Cups">/);
  assert.match(body, /\*\*Open question:\*\* bit cutoff; 31 proposed\n/);
  assert.deepEqual(parseQuestionTag(body), { path: q.path, marker: q.marker, card: "ace-of-cups" });
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
  const body = questionBody(q, { rng: () => 0, templates: [dir] });
  assert.equal(body.split("\n")[0], "Q: bit cutoff; 31 proposed (Ace of Cups)");
  assert.ok(parseQuestionTag(body), "the tag survives a custom template");
});

test("a question already asked, or asked twice in one file, is posted once", () => {
  const qs = questionsIn("docs/specs/a/b.md", SPEC + SPEC.split("\n")[2] + "\n");
  assert.equal(qs.length, 3);
  assert.deepEqual(unasked(qs, []).map(q => q.line), [3, 4]);
  assert.deepEqual(unasked(qs, ["hi", questionBody(qs[0])]).map(q => q.line), [4]);
});

test("a reply is read on one line", () => {
  assert.equal(normaliseAnswer("  31\r\n\r\n"), "31");
  assert.equal(normaliseAnswer("first line\nsecond line"), "first line second line");
});

test("a quoted reply goes in as written; anything else goes to the interpreter", () => {
  assert.equal(literal('"31"'), "31");
  assert.equal(literal(" `at most 31` \n"), "at most 31");
  assert.equal(literal("“fifty”"), "fifty");
  assert.equal(literal("yeah 31"), null);
  assert.equal(literal('"31" is fine'), null);
});

test("only a well-formed verdict from the model is used", () => {
  assert.deepEqual(parseVerdict('Sure! {"verdict":"answer","text":" 31\\n"}'), { verdict: "answer", text: "31" });
  assert.deepEqual(parseVerdict('{"verdict":"unclear","note":"Which floor?"}'), { verdict: "unclear", note: "Which floor?" });
  assert.equal(parseVerdict('{"verdict":"answer","text":""}'), null);
  assert.equal(parseVerdict('{"verdict":"maybe"}'), null);
  assert.equal(parseVerdict("31"), null);
  assert.equal(fitSpan("- AC1: at most 28 of 256 bits.", "- AC1: at most ", " of 256 bits."), "28");
  assert.equal(fitSpan("28", "- AC1: at most ", " of 256 bits."), "28");
  assert.match(prompt({ question: "q", before: "at most ", span: "[M]", after: " bits", reply: "31" }), /Line: at most ⟦\[M\]⟧ bits/);
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

// Answers by rule: a reply naming a number decides it, "why" asks back, anything else is unclear.
function fakeInterpreter() {
  const seen: InterpretInput[] = [];
  const interpreter: Interpreter = {
    interpret(i): Verdict {
      seen.push(i);
      if (/why/i.test(i.reply)) return { verdict: "not-an-answer", note: "Say which cutoff to use." };
      const n = /\d+/.exec(i.reply)?.[0];
      return n ? { verdict: "answer", text: n } : { verdict: "unclear", note: "Which value?" };
    },
  };
  return { interpreter, seen };
}

test("a poll asks each open question once, on spec change requests only", () => {
  const { tracker, notes } = fakeTracker({ "docs/specs/a/b.md": SPEC, "src/x.ts": "[NEEDS CLARIFICATION: not a spec]" });
  const opts = { self: [], rng: () => 0, interpreter: fakeInterpreter().interpreter };
  assert.equal(pollQuestions(tracker, opts).length, 2);
  assert.deepEqual(pollQuestions(tracker, opts), []);
  assert.deepEqual(notes.map(n => parseQuestionTag(n.body)?.marker), [
    "[NEEDS CLARIFICATION: bit cutoff; 31 proposed]",
    "[NEEDS CLARIFICATION: floor; 50 proposed]",
  ]);
});

test("a plain-words reply is interpreted, written in place of the marker, and shown as a diff", () => {
  const { tracker, notes, files, commits, cr, me } = fakeTracker({ "docs/specs/a/b.md": SPEC });
  const { interpreter, seen } = fakeInterpreter();
  const opts = { self: [], rng: () => 0, interpreter };
  pollChangeRequest(tracker, cr, opts);
  notes.push({ id: 10, body: "yeah 31 is fine\n", author: me, replyTo: 1 });
  notes.push({ id: 11, body: "50", author: { login: "drive-by", bot: false, member: false }, replyTo: 2 });

  assert.deepEqual(pollChangeRequest(tracker, cr, { ...opts, dryRun: true }),
    ["#1 docs/specs/a/b.md: would write: - AC1: Hashes differ in at most 31 of 256 bits."]);
  assert.equal(commits.length, 0);
  assert.deepEqual(seen[0], {
    question: "bit cutoff; 31 proposed", before: "- AC1: Hashes differ in at most ",
    span: "[NEEDS CLARIFICATION: bit cutoff; 31 proposed]", after: " of 256 bits.", reply: "yeah 31 is fine",
  });

  assert.deepEqual(pollChangeRequest(tracker, cr, opts), ["#1 docs/specs/a/b.md: answered in c1abcde"]);
  assert.match(files["docs/specs/a/b.md"], /^- AC1: Hashes differ in at most 31 of 256 bits\.$/m);
  assert.match(files["docs/specs/a/b.md"], /\[NEEDS CLARIFICATION: floor/, "the drive-by reply changed nothing");
  assert.match(commits[0], /^Answer an open question in docs\/specs\/a\/b\.md\n[\s\S]*→ 31\n\nAnswered by @tom\.$/);
  const answered = notes.at(-1)!;
  assert.equal(answered.replyTo, 1);
  assert.equal(parseReplyTag(answered.body)?.note, 10);
  assert.match(answered.body, /```diff\n- - AC1: Hashes differ in at most \[NEEDS[^\n]+\n\+ - AC1: Hashes differ in at most 31 of 256 bits\.\n```/);
  assert.match(answered.body, /1 open question left on this change\. Reply here to correct it\./);
  assert.deepEqual(pollChangeRequest(tracker, cr, opts), [], "a handled reply is not read again");
});

test("replies in a thread show the question's card, even when the deck draws another", () => {
  const { tracker, notes, cr, me } = fakeTracker({ "docs/specs/a/b.md": SPEC });
  let draw = 0;
  const opts = { self: [], rng: () => draw, interpreter: fakeInterpreter().interpreter };
  pollChangeRequest(tracker, cr, opts);
  draw = 0.999;
  notes.push({ id: 10, body: "why?", author: me, replyTo: 1 });
  notes.push({ id: 11, body: "31", author: me, replyTo: 1 });
  pollChangeRequest(tracker, cr, opts);
  const replies = notes.filter(n => n.replyTo === 1 && parseReplyTag(n.body));
  assert.equal(replies.length, 2);
  for (const r of replies) assert.match(r.body, /\/tarot\/ace-of-cups\.png" alt="Ace of Cups"/);
});

test("a question asked before its tag named a card lends its image's card to replies", () => {
  const { tracker, notes, cr, me } = fakeTracker({ "docs/specs/a/b.md": SPEC });
  const [q] = questionsIn("docs/specs/a/b.md", SPEC);
  notes.push({ id: 1, body: `${card("the-moon").html}\n\n${questionTag(q)}`, author: me });
  notes.push({ id: 10, body: "why?", author: me, replyTo: 1 });
  pollChangeRequest(tracker, cr, { self: [], rng: () => 0, interpreter: fakeInterpreter().interpreter });
  assert.match(notes.find(n => n.replyTo === 1 && parseReplyTag(n.body))!.body, /alt="The Moon"/);
});

test("a later reply corrects the answer on its line; a question back changes nothing", () => {
  const { tracker, notes, files, commits, cr, me } = fakeTracker({ "docs/specs/a/b.md": SPEC });
  const { interpreter, seen } = fakeInterpreter();
  const opts = { self: [], rng: () => 0, interpreter };
  pollChangeRequest(tracker, cr, opts);
  notes.push({ id: 10, body: '"31"', author: me, replyTo: 1 });
  pollChangeRequest(tracker, cr, opts);
  assert.equal(seen.length, 0, "a quoted reply skips the interpreter");

  notes.push({ id: 20, body: "why not lower?", author: me, replyTo: 1 });
  notes.push({ id: 21, body: "no, make it 28", author: me, replyTo: 1 });
  assert.deepEqual(pollChangeRequest(tracker, cr, opts), [
    "#1 docs/specs/a/b.md: not-an-answer: Say which cutoff to use.",
    "#1 docs/specs/a/b.md: corrected in c2abcde",
  ]);
  assert.equal(seen[1].span, "31");
  assert.match(files["docs/specs/a/b.md"], /^- AC1: Hashes differ in at most 28 of 256 bits\.$/m);
  assert.match(commits[1], /^Correct the answer to an open question/);
  assert.match(notes.find(n => parseReplyTag(n.body)?.note === 20)!.body, /Say which cutoff to use\.\n\nNothing changed\./);
  assert.deepEqual(pollChangeRequest(tracker, cr, opts), []);
});

test("a reply whose line has changed is told so, and a failing interpreter leaves the reply for next time", () => {
  const { tracker, notes, files, commits, cr, me } = fakeTracker({ "docs/specs/a/b.md": SPEC });
  let fail = true;
  const interpreter: Interpreter = { interpret: i => { if (fail) throw new Error("pi: rate limited"); return fakeInterpreter().interpreter.interpret(i); } };
  const opts = { self: [], rng: () => 0, interpreter };
  pollChangeRequest(tracker, cr, opts);
  notes.push({ id: 10, body: "31 please", author: me, replyTo: 1 });
  assert.deepEqual(pollChangeRequest(tracker, cr, opts), ["#1 docs/specs/a/b.md: reply 10 not read, will retry: pi: rate limited"]);
  fail = false;
  assert.deepEqual(pollChangeRequest(tracker, cr, opts), ["#1 docs/specs/a/b.md: answered in c1abcde"]);

  files["docs/specs/a/b.md"] = files["docs/specs/a/b.md"].replace("31 of 256", "31 out of 256");
  notes.push({ id: 30, body: "make it 28", author: me, replyTo: 1 });
  assert.deepEqual(pollChangeRequest(tracker, cr, opts), ["#1 docs/specs/a/b.md: the answered line has changed since; correction not applied"]);
  assert.match(notes.at(-1)!.body, /has changed since/);
  assert.equal(commits.length, 1);
});
