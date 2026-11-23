// Reading a person's reply to an open question. A small model turns plain words ("yeah, go with
// 31") into the text that stands in the spec, or says the reply doesn't decide anything. It only
// ever returns replacement text: the code that calls it does the substitution, on one span of one
// line, so a misreading can't reach anything else in the file.

import { execFileSync } from "node:child_process";

export type Verdict = { verdict: "answer"; text: string } | { verdict: "not-an-answer" | "unclear"; note: string };

export interface InterpretInput {
  question: string; // the marker's question, without the brackets
  before: string; // the line up to the span being replaced
  span: string; // the marker, or the earlier answer a correction replaces
  after: string; // the rest of the line
  reply: string;
}

export interface Interpreter {
  interpret(input: InterpretInput): Verdict;
}

// A reply wrapped in quotes or backticks goes in exactly as written, with no model.
export function literal(reply: string): string | null {
  const m = /^\s*(?:"([^"\n]+)"|“([^”\n]+)”|`([^`\n]+)`)\s*$/.exec(reply);
  return m ? (m[1] ?? m[2] ?? m[3]).trim() || null : null;
}

const MAX = 600;

// The model's output, checked: one JSON object of the right shape, answer text on one line.
export function parseVerdict(raw: string): Verdict | null {
  const json = /\{[\s\S]*\}/.exec(raw)?.[0];
  if (!json) return null;
  let v: any;
  try {
    v = JSON.parse(json);
  } catch {
    return null;
  }
  if (v?.verdict === "answer" && typeof v.text === "string") {
    const text = v.text.replace(/\s*\n\s*/g, " ").trim();
    return text && text.length <= MAX ? { verdict: "answer", text } : null;
  }
  if ((v?.verdict === "not-an-answer" || v?.verdict === "unclear") && typeof v.note === "string" && v.note.trim()) {
    return { verdict: v.verdict, note: v.note.trim().slice(0, MAX) };
  }
  return null;
}

export const SYSTEM = `You read a spec author's reply to an open question in a Markdown spec and decide what it means.
The question sits in one line of the spec, at the span marked ⟦like this⟧. Output one JSON object and nothing else:

{"verdict":"answer","text":"..."}
  The reply decides the question. "text" replaces only the marked span: never include the words before or after
  it. The whole line, with your text in place of the span, must read as correct spec prose.
  Keep exactly what the author decided and add nothing they didn't. If the question proposes a value and they accept
  it, use that value. Fit the slot: a number where a number belongs, a clause where a clause belongs. Don't repeat
  words already on the line around the span. Plain text on one line, no Markdown emphasis.

{"verdict":"not-an-answer","note":"..."}
  The reply asks something back, discusses, or defers without deciding. "note" is one sentence to the author, under
  20 words, on what is still needed to answer.

{"verdict":"unclear","note":"..."}
  The reply seems to decide but you can't tell what. "note" is one question to the author, under 20
  words, asking what they meant.`;

export function prompt(i: InterpretInput): string {
  return `Question: ${i.question}\n\nLine: ${i.before}⟦${i.span}⟧${i.after}\n\nReply:\n${i.reply}`;
}

// A model sometimes returns the whole line; keep only what stands in the span.
export function fitSpan(text: string, before: string, after: string): string {
  let t = text;
  const b = before.trim(),
    a = after.trim();
  if (b && t.startsWith(b)) t = t.slice(b.length);
  if (a && t.endsWith(a)) t = t.slice(0, -a.length);
  return t.trim() || text;
}

// The model runs through `pi`, with no tools, skills or context files.
export function piInterpreter(model = process.env.UD_INTERPRETER_MODEL ?? "anthropic/claude-haiku-5-5"): Interpreter {
  return {
    interpret(input) {
      const ask = () =>
        execFileSync(
          "pi",
          [
            "-p",
            "--no-session",
            "--no-tools",
            "--no-skills",
            "--no-extensions",
            "--no-mcp",
            "--no-context-files",
            "--no-prompt-templates",
            "--no-themes",
            "--model",
            model,
            "--thinking",
            "low",
            "--system-prompt",
            SYSTEM,
            prompt(input),
          ],
          { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120_000 },
        );
      const v = parseVerdict(ask()) ?? parseVerdict(ask());
      if (!v) throw new Error("the interpreter returned no usable verdict twice");
      return v.verdict === "answer" ? { ...v, text: fitSpan(v.text, input.before, input.after) } : v;
    },
  };
}
