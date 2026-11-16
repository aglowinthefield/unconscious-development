// Open questions on a spec PR. `ask` posts one review comment per [NEEDS CLARIFICATION] marker,
// on the marker's line. `answer` takes a reply in that thread and puts its text in the file in
// place of the marker. Each question comment carries a tag naming the file and the exact marker,
// so a later push or a second run never asks twice and the answer finds its marker.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { markers } from "./markdown.ts";
import type { ChangeRequest, Person, Tracker } from "./tracker/tracker.ts";

export interface Question {
  path: string;
  line: number;
  marker: string;
}

const TAG = /<!-- ud-question ([A-Za-z0-9_-]+) -->/;

export function questionTag(q: { path: string; marker: string }): string {
  const payload = Buffer.from(JSON.stringify({ path: q.path, marker: q.marker })).toString("base64url");
  return `<!-- ud-question ${payload} -->`;
}

export function parseQuestionTag(body: string): { path: string; marker: string } | null {
  const m = TAG.exec(body);
  if (!m) return null;
  try {
    const { path, marker } = JSON.parse(Buffer.from(m[1], "base64url").toString("utf8"));
    return typeof path === "string" && typeof marker === "string" ? { path, marker } : null;
  } catch {
    return null;
  }
}

// Paths a question may name: a spec, plan or Persona inside the repo, nothing else.
export function answerablePath(path: string): boolean {
  return /^docs\/(specs|personas)\/[^\0]+\.md$/.test(path) && !path.split("/").includes("..");
}

export function questionsIn(path: string, text: string): Question[] {
  return markers(text).map(m => ({ path, line: m.line, marker: m.text }));
}

// Markers no existing comment has asked about yet. A marker asked once is never asked again, even
// after its thread is answered, because an answered marker is gone from the file.
export function unasked(questions: Question[], commentBodies: string[]): Question[] {
  const asked = new Set(
    commentBodies.map(parseQuestionTag).filter(Boolean).map(t => `${t!.path}\n${t!.marker}`),
  );
  const seen = new Set<string>();
  return questions.filter(q => {
    const key = `${q.path}\n${q.marker}`;
    if (asked.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function questionBody(q: Question): string {
  const text = q.marker.replace(/^\[NEEDS CLARIFICATION:\s*/, "").replace(/\]$/, "");
  return [
    `**Open question:** ${text}`,
    "",
    "Reply in this thread with the words that should stand in the file instead of the marker. Your reply replaces it as written, on the same line, and is committed to this branch.",
    "",
    questionTag(q),
  ].join("\n");
}

// One line of text: the marker sits inside a sentence or list item, so a line break would split it.
export function normaliseAnswer(body: string): string {
  return body.replace(/\r\n/g, "\n").split(/\n+/).map(l => l.trim()).filter(Boolean).join(" ");
}

export function applyAnswer(text: string, marker: string, answer: string): string | null {
  if (!text.includes(marker)) return null;
  return text.split(marker).join(answer);
}

// Who may answer: a person with a stake in the repo, never a bot. When UD_SELF lists logins,
// only those.
export function mayAnswer(author: Person, self: string[] = []): boolean {
  if (author.bot) return false;
  if (self.length) return self.includes(author.login);
  return author.member;
}

function openQuestions(tracker: Tracker, cr: ChangeRequest): Question[] {
  return cr.files.filter(answerablePath).flatMap(path => {
    const text = tracker.fileAt(path, cr.head);
    return text === null ? [] : questionsIn(path, text);
  });
}

// Ask every open question on the change request that no note has asked yet. Returns how many.
export function askQuestions(tracker: Tracker, ref: number, dryRun = false): number {
  const cr = tracker.getChangeRequest(ref);
  const fresh = unasked(openQuestions(tracker, cr), tracker.notes(cr).map(n => n.body));
  for (const q of fresh) {
    if (!dryRun) tracker.postNote(cr, { path: q.path, line: q.line, body: questionBody(q) });
    console.log(`${dryRun ? "would ask" : "asked"} ${q.path}:${q.line} ${q.marker}`);
  }
  if (!fresh.length) console.log("no unasked questions");
  return fresh.length;
}

const git = (root: string, args: string[]) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

// Apply a reply to a question: replace the marker in the branch checked out at `root`, commit,
// push, and say so in the thread. Anything that isn't a permitted answer is ignored.
export function answerQuestion(
  tracker: Tracker, root: string, ref: number, noteId: number, opts: { self: string[]; dryRun?: boolean },
): string {
  const cr = tracker.getChangeRequest(ref);
  const note = tracker.getNote(cr, noteId);
  if (!note.replyTo) return "not a reply; ignored";
  const thread = tracker.getNote(cr, note.replyTo);
  const tag = parseQuestionTag(thread.body);
  if (!tag || !thread.author.bot) return "not a reply to an open question; ignored";
  if (!mayAnswer(note.author, opts.self)) return `${note.author.login} may not answer; ignored`;
  if (!answerablePath(tag.path)) return `refusing to edit ${tag.path}`;

  const answer = normaliseAnswer(note.body);
  if (!answer) return "empty reply; ignored";
  const file = join(root, tag.path);
  const next = applyAnswer(readFileSync(file, "utf8"), tag.marker, answer);
  if (next === null) {
    if (!opts.dryRun) tracker.reply(cr, thread.id, "This question is no longer in the file, so the reply changed nothing.");
    return "marker already gone";
  }
  if (opts.dryRun) return `would replace ${tag.marker} in ${tag.path} with: ${answer}`;

  writeFileSync(file, next);
  git(root, ["add", "--", tag.path]);
  // The committer comes from git's own config or GIT_AUTHOR_*/GIT_COMMITTER_* (the workflow sets them).
  git(root, ["commit", "-q", "-m", `Answer an open question in ${tag.path}`, "-m", `${tag.marker}\n\n→ ${answer}\n\nAnswered by @${note.author.login}.`]);
  git(root, ["push", "-q", "origin", `HEAD:${cr.branch}`]);
  const sha = git(root, ["rev-parse", "HEAD"]).slice(0, 7);

  const left = cr.files.filter(answerablePath).flatMap(path => {
    try { return questionsIn(path, readFileSync(join(root, path), "utf8")); } catch { return []; }
  }).length;
  tracker.reply(cr, thread.id, left
    ? `Answered in ${sha}. ${left} open question${left === 1 ? "" : "s"} left on this change.`
    : `Answered in ${sha}. No open questions left; set \`status: approved\` in the spec when you approve it.`);
  askQuestions(tracker, ref); // an answer may itself hold a new marker
  return `answered ${tag.path} in ${sha}`;
}
