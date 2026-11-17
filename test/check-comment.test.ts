import { test } from "node:test";
import assert from "node:assert/strict";
import { postCheckResult, problemList } from "../src/check-comment.ts";
import type { ChangeRequest, Note, Tracker } from "../src/tracker/tracker.ts";

function fakeTracker() {
  const comments: Note[] = [];
  const me = { login: "ci", bot: true, member: false };
  const cr: ChangeRequest = { number: 7, head: "abcdef1234", branch: "spec/7", files: [] };
  const tracker = {
    changeComments: () => comments.map(c => ({ ...c })),
    commentOnChange: (_: ChangeRequest, body: string) => void comments.push({ id: comments.length + 1, body, author: me }),
    editComment: (_: ChangeRequest, id: number, body: string) => void (comments.find(c => c.id === id)!.body = body),
    fileUrl: (path: string, ref: string, line?: number) => `u/${ref}/${path}${line ? `#L${line}` : ""}`,
  } as unknown as Tracker;
  return { tracker, comments, cr };
}

const invariant = { file: "docs/specs/a/b.plan.md", message: "invariant a/I2 must start `holds` or `exception: <reason>`; got \"maybe\"" };
const question = (n: number) => ({ file: "docs/specs/a/b.md", line: n, message: `open question: [NEEDS CLARIFICATION: q${n}]` });

test("each problem is listed with a link to its file or line", () => {
  assert.equal(problemList([invariant, question(3)], (f, l) => (l ? `${f}#L${l}` : f)),
    "- [`docs/specs/a/b.plan.md`](docs/specs/a/b.plan.md): invariant a/I2 must start `holds` or `exception: <reason>`; got \"maybe\"\n" +
    "- [`docs/specs/a/b.md:3`](docs/specs/a/b.md#L3): open question: [NEEDS CLARIFICATION: q3]");
  assert.match(problemList([{ ...invariant, line: 9 }], (f, l) => `${f}#L${l}`), /^- \[`docs\/specs\/a\/b\.plan\.md:9`\]\(docs\/specs\/a\/b\.plan\.md#L9\)/);
});

test("one comment explains a failure, follows each run, and says when the check passes", () => {
  const { tracker, comments, cr } = fakeTracker();
  assert.equal(postCheckResult(tracker, cr, [], { rng: () => 0 }), "check passes; no comment to update");
  assert.equal(comments.length, 0, "a passing check with no earlier failure says nothing");

  assert.equal(postCheckResult(tracker, cr, [invariant], { rng: () => 0 }), "posted the check comment");
  assert.match(comments[0].body, /check-spec fails on abcdef1:\n\n- \[`docs\/specs\/a\/b\.plan\.md`\]\(u\/abcdef1234\/docs\/specs\/a\/b\.plan\.md\): invariant a\/I2/);
  assert.match(comments[0].body, /alt="Ace of Cups"/);
  assert.equal(postCheckResult(tracker, cr, [invariant], { rng: () => 0 }), "check comment already current");

  cr.head = "1234567abc";
  assert.equal(postCheckResult(tracker, cr, [], { rng: () => 0.999 }), "updated the check comment");
  assert.equal(comments.length, 1);
  assert.match(comments[0].body, /check-spec passes on 1234567\./);
  assert.match(comments[0].body, /alt="Ace of Cups"/, "the comment keeps its card");
});
