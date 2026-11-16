// Open questions on a spec change request, polled. Each [NEEDS CLARIFICATION] marker is asked as
// a note on its line; a reply in that thread from someone who may answer is put in the file in
// place of the marker and committed to the branch, and the thread is resolved. Each question carries a tag naming the file and
// the exact marker, and each reply this tool posts carries a tag naming the note it settled, so
// the tracker itself is the record of what has been done.

import { CARDS, card, cardIn, drawCard, type Card } from "./cards.ts";
import { loadTemplate, render, type Kind } from "./comments.ts";
import { literal, type Interpreter } from "./interpret.ts";
import { markers } from "./markdown.ts";
import type { ChangeRequest, Note, Person, Tracker } from "./tracker/tracker.ts";

export interface Question {
  path: string;
  line: number;
  marker: string;
}

const TAG = /<!-- ud-question ([A-Za-z0-9_-]+) -->/;
const REPLY_TAG = /<!-- ud-reply ([A-Za-z0-9_-]+) -->/;

// What a reply this tool posted records: the note it settled and, when it changed the file, the
// line as written and where the answer sits in it, so a correction can find that answer again.
export interface Settled { note: number; line?: string; at?: number; inserted?: string }

export const replyTag = (s: Settled) => `<!-- ud-reply ${Buffer.from(JSON.stringify(s)).toString("base64url")} -->`;

export function parseReplyTag(body: string): Settled | null {
  const m = REPLY_TAG.exec(body);
  if (!m) return null;
  if (/^\d+$/.test(m[1])) return { note: Number(m[1]) };
  try {
    const s = JSON.parse(Buffer.from(m[1], "base64url").toString("utf8"));
    return typeof s?.note === "number" ? s : null;
  } catch {
    return null;
  }
}

// The tag also names the question's card, so replies in its thread show the same one whatever the
// template does with it.
export function questionTag(q: { path: string; marker: string }, card?: string): string {
  const payload = Buffer.from(JSON.stringify({ path: q.path, marker: q.marker, card })).toString("base64url");
  return `<!-- ud-question ${payload} -->`;
}

export function parseQuestionTag(body: string): { path: string; marker: string; card?: string } | null {
  const m = TAG.exec(body);
  if (!m) return null;
  try {
    const { path, marker, card } = JSON.parse(Buffer.from(m[1], "base64url").toString("utf8"));
    if (typeof path !== "string" || typeof marker !== "string") return null;
    return (CARDS as readonly string[]).includes(card) ? { path, marker, card } : { path, marker };
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
  interpreter: Interpreter; // reads plain-words replies
}

function compose(kind: Kind, vars: Record<string, string | number>, tag: string, opts: Pick<PollOptions, "rng" | "templates">, c: Card): string {
  return `${render(loadTemplate(kind, opts.templates), { ...vars, card: c.html, card_name: c.name, card_url: c.url })}\n\n${tag}`;
}

const questionText = (marker: string) => marker.replace(/^\[NEEDS CLARIFICATION:\s*/, "").replace(/\]$/, "");

export function questionBody(q: Question, opts: Pick<PollOptions, "rng" | "templates"> = {}): string {
  const c = drawCard(opts.rng);
  return compose("question", { question: questionText(q.marker), marker: q.marker, path: q.path, line: q.line }, questionTag(q, c.slug), opts, c);
}

// Comments this tool posted carry a tag; a person's reply never does.
const isOurs = (body: string) => TAG.test(body) || REPLY_TAG.test(body);

// The card a thread's replies show: the question's own, from its tag or (for questions asked
// before the tag named it) its image; a fresh draw only when the question shows none.
function threadCard(question: string, rng?: () => number): Card {
  const slug = parseQuestionTag(question)?.card;
  return slug ? card(slug) : cardIn(question) ?? drawCard(rng);
}

// Act on one reply in a question thread. Before the question is answered, the reply's answer goes
// in place of the marker; after, a further reply corrects that answer on the line it was written to.
function settle(
  tracker: Tracker, cr: ChangeRequest, tag: { path: string; marker: string }, threadId: number, reply: Note,
  answered: Settled | undefined, c: Card, opts: PollOptions,
): { log: string; answered?: Settled } {
  const post = (kind: Kind, vars: Record<string, string | number>, s: Settled) => {
    if (!opts.dryRun) tracker.reply(cr, threadId, compose(kind, { ...vars, marker: tag.marker, path: tag.path }, replyTag(s), opts, c));
  };
  // The question is closed once its marker is gone from the file, so its thread is done. The reply
  // is already posted, so a failure here is reported and not retried.
  const close = (log: string) => {
    if (opts.dryRun) return log;
    try {
      tracker.resolve(cr, threadId);
      return log;
    } catch (e: any) {
      return `${log}; thread not resolved: ${String(e.stderr || e.message).split("\n")[0]}`;
    }
  };
  const text = tracker.fileAt(tag.path, cr.head) ?? "";
  const lines = text.split("\n");
  // Find the span to replace: the marker, or the earlier answer on the line it was written to.
  let index: number, at: number, span: string;
  if (answered?.line !== undefined) {
    index = lines.indexOf(answered.line);
    at = answered.at ?? -1;
    span = answered.inserted ?? "";
    if (index < 0 || answered.line.slice(at, at + span.length) !== span) index = -1;
  } else {
    index = lines.findIndex(l => l.includes(tag.marker));
    at = index < 0 ? -1 : lines[index].indexOf(tag.marker);
    span = tag.marker;
  }
  if (index < 0) {
    post("gone", {}, { note: reply.id });
    return { log: answered ? "the answered line has changed since; correction not applied" : close("question already gone") };
  }
  const line = lines[index];
  const before = line.slice(0, at), after = line.slice(at + span.length);
  const quoted = literal(reply.body);
  const verdict = quoted !== null
    ? { verdict: "answer" as const, text: quoted }
    : opts.interpreter.interpret({ question: questionText(tag.marker), before, span, after, reply: normaliseAnswer(reply.body) });
  if (verdict.verdict !== "answer") {
    post("unclear", { note: verdict.note, verdict: verdict.verdict }, { note: reply.id });
    return { log: `${verdict.verdict}: ${verdict.note}` };
  }
  const newLine = before + verdict.text + after;
  if (opts.dryRun) return { log: `would write: ${newLine.trim()}` };
  lines[index] = newLine;
  const sha = tracker.commitFile(cr, {
    path: tag.path, content: lines.join("\n"),
    message: `${answered ? "Correct the answer to" : "Answer"} an open question in ${tag.path}\n\n${tag.marker}\n\n→ ${verdict.text}\n\n${answered ? "Corrected" : "Answered"} by @${reply.author.login}.`,
  });
  cr.head = sha;
  const s: Settled = { note: reply.id, line: newLine, at, inserted: verdict.text };
  post("answered", {
    answer: verdict.text, before: line.trim(), after: newLine.trim(), sha: sha.slice(0, 7), author: reply.author.login,
  }, s);
  return { log: close(`${answered ? "corrected" : "answered"} in ${sha.slice(0, 7)}`), answered: s };
}

// One pass over a change request: apply each new answer, then ask each new question. Every comment
// is a tracker note, so the pass keeps no state of its own and running it twice changes nothing.
export function pollChangeRequest(tracker: Tracker, cr: ChangeRequest, opts: PollOptions): string[] {
  if (!cr.files.some(answerablePath)) return [];
  const log: string[] = [];
  const notes = tracker.notes(cr);

  for (const thread of notes) {
    const tag = !thread.replyTo && parseQuestionTag(thread.body);
    if (!tag || !answerablePath(tag.path)) continue;
    const replies = notes.filter(n => n.replyTo === thread.id).sort((a, b) => a.id - b.id);
    const settled = replies.map(r => parseReplyTag(r.body)).filter((x): x is Settled => x !== null);
    const handled = new Set(settled.map(x => x.note));
    let answered = settled.filter(x => x.line !== undefined).at(-1); // the answer standing in the file, if any
    const c = threadCard(thread.body, opts.rng);
    for (const reply of replies) {
      if (isOurs(reply.body) || handled.has(reply.id) || !mayAnswer(reply.author, opts.self) || !normaliseAnswer(reply.body)) continue;
      try {
        const result = settle(tracker, cr, tag, thread.id, reply, answered, c, opts);
        log.push(`#${cr.number} ${tag.path}: ${result.log}`);
        if (result.answered) answered = result.answered;
      } catch (e: any) {
        // Nothing was recorded, so the next run tries this reply again.
        log.push(`#${cr.number} ${tag.path}: reply ${reply.id} not read, will retry: ${String(e.stderr || e.message).split("\n")[0]}`);
        break;
      }
    }
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
