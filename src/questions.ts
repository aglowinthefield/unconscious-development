// Open questions on a spec PR. `ask` posts one review comment per [NEEDS CLARIFICATION] marker,
// on the marker's line. `answer` takes a reply in that thread and puts its text in the file in
// place of the marker. Each question comment carries a tag naming the file and the exact marker,
// so a later push or a second run never asks twice and the answer finds its marker.

import { markers } from "./markdown.ts";

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
export function mayAnswer(
  author: { login: string; type: string },
  association: string,
  self: string[] = [],
): boolean {
  if (author.type === "Bot") return false;
  if (self.length) return self.includes(author.login);
  return ["OWNER", "MEMBER", "COLLABORATOR"].includes(association);
}
