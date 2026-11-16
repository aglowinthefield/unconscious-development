// Open questions on a spec change request, polled. Each [NEEDS CLARIFICATION] marker is asked as
// a note on its line; a reply in that thread from someone who may answer is put in the file in
// place of the marker and committed to the branch. Each question carries a tag naming the file and
// the exact marker, and each reply this tool posts carries a tag naming the note it settled, so
// the tracker itself is the record of what has been done.

import { drawCard } from "./cards.ts";
import { loadTemplate, render, type Kind } from "./comments.ts";
import { markers } from "./markdown.ts";
import type { ChangeRequest, Person, Tracker } from "./tracker/tracker.ts";

export interface Question {
  path: string;
  line: number;
  marker: string;
}

const TAG = /<!-- ud-question ([A-Za-z0-9_-]+) -->/;
const REPLY_TAG = /<!-- ud-reply (\d+) -->/;

// Marks a reply this tool posted, naming the note it answered.
export const replyTag = (noteId: number) => `<!-- ud-reply ${noteId} -->`;

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

export interface PollOptions {
  self: string[]; // UD_SELF: when set, only these logins answer
  dryRun?: boolean;
  rng?: () => number; // draws the card
  templates?: string[]; // template dirs, override first
}

function compose(kind: Kind, vars: Record<string, string | number>, tag: string, opts: PollOptions): string {
  const c = drawCard(opts.rng);
  return `${render(loadTemplate(kind, opts.templates), { ...vars, card: c.html, card_name: c.name, card_url: c.url })}\n\n${tag}`;
}

const questionText = (marker: string) => marker.replace(/^\[NEEDS CLARIFICATION:\s*/, "").replace(/\]$/, "");

export function questionBody(q: Question, opts: PollOptions = { self: [] }): string {
  return compose("question", { question: questionText(q.marker), marker: q.marker, path: q.path, line: q.line }, questionTag(q), opts);
}

// Comments this tool posted carry a tag; a person's reply never does.
const isOurs = (body: string) => TAG.test(body) || REPLY_TAG.test(body);

// One pass over a change request: apply each new answer, then ask each new question. Every comment
// is a tracker note, so the pass keeps no state of its own and running it twice changes nothing.
export function pollChangeRequest(tracker: Tracker, cr: ChangeRequest, opts: PollOptions): string[] {
  if (!cr.files.some(answerablePath)) return [];
  const log: string[] = [];
  const notes = tracker.notes(cr);

  for (const thread of notes) {
    const tag = !thread.replyTo && parseQuestionTag(thread.body);
    if (!tag || !answerablePath(tag.path)) continue;
    const replies = notes.filter(n => n.replyTo === thread.id);
    if (replies.some(r => REPLY_TAG.test(r.body))) continue; // this thread is settled
    const reply = replies.find(r => !isOurs(r.body) && mayAnswer(r.author, opts.self) && normaliseAnswer(r.body));
    if (!reply) continue;
    const answer = normaliseAnswer(reply.body);
    const text = tracker.fileAt(tag.path, cr.head);
    const next = text === null ? null : applyAnswer(text, tag.marker, answer);
    const where = `#${cr.number} ${tag.path}`;
    if (next === null) {
      if (!opts.dryRun) tracker.reply(cr, thread.id, compose("gone", { marker: tag.marker, path: tag.path }, replyTag(reply.id), opts));
      log.push(`${where}: question already gone`);
      continue;
    }
    if (opts.dryRun) { log.push(`${where}: would answer ${tag.marker} with: ${answer}`); continue; }
    const sha = tracker.commitFile(cr, {
      path: tag.path, content: next,
      message: `Answer an open question in ${tag.path}\n\n${tag.marker}\n\n→ ${answer}\n\nAnswered by @${reply.author.login}.`,
    });
    cr.head = sha;
    const left = openQuestions(tracker, cr).length;
    const remaining = left
      ? `${left} open question${left === 1 ? "" : "s"} left on this change.`
      : "No open questions left; set `status: approved` in the spec when you approve it.";
    tracker.reply(cr, thread.id, compose("answered",
      { answer, sha: sha.slice(0, 7), remaining, left, author: reply.author.login, marker: tag.marker, path: tag.path },
      replyTag(reply.id), opts));
    log.push(`${where}: answered in ${sha.slice(0, 7)}`);
  }

  // Ask after answering: an answer can carry a new marker, and new questions go on the new head.
  const fresh = unasked(openQuestions(tracker, cr), (opts.dryRun ? notes : tracker.notes(cr)).map(n => n.body));
  for (const q of fresh) {
    if (!opts.dryRun) tracker.postNote(cr, { path: q.path, line: q.line, body: questionBody(q, opts) });
    log.push(`#${cr.number} ${q.path}:${q.line}: ${opts.dryRun ? "would ask" : "asked"} ${q.marker}`);
  }
  return log;
}

// Every open change request in the tracker's repo.
export function pollQuestions(tracker: Tracker, opts: PollOptions): string[] {
  return tracker.openChangeRequests().flatMap(cr => pollChangeRequest(tracker, cr, opts));
}
