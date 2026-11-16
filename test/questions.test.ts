import { test } from "node:test";
import assert from "node:assert/strict";
import {
  answerablePath, applyAnswer, mayAnswer, normaliseAnswer, parseQuestionTag, questionBody, questionsIn, unasked,
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
  const tom = { login: "tom", type: "User" };
  assert.ok(mayAnswer(tom, "OWNER"));
  assert.ok(mayAnswer(tom, "MEMBER"));
  assert.ok(!mayAnswer(tom, "CONTRIBUTOR"));
  assert.ok(!mayAnswer({ login: "x[bot]", type: "Bot" }, "OWNER"));
  assert.ok(mayAnswer(tom, "CONTRIBUTOR", ["tom"]));
  assert.ok(!mayAnswer({ login: "zane", type: "User" }, "MEMBER", ["tom"]));
});
