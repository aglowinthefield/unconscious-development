// The check-spec result as one comment on the change request, so a reviewer sees why the check
// fails without opening the job log. Each failing run rewrites the same comment; a passing run
// rewrites it to say so, and posts nothing when there was never a failure to explain.

import { cardIn, drawCard } from "./cards.ts";
import { loadTemplate, render } from "./comments.ts";
import type { Problem } from "./spec.ts";
import type { ChangeRequest, Tracker } from "./tracker/tracker.ts";

const TAG = "<!-- ud-check -->";
export function problemList(problems: Problem[], link: (file: string, line?: number) => string): string {
  return problems.map(p => {
    const where = p.line ? `${p.file}:${p.line}` : p.file;
    return `- [\`${where}\`](${link(p.file, p.line)}): ${p.message}`;
  }).join("\n");
}

export interface CheckCommentOptions { templates?: string[]; rng?: () => number; dryRun?: boolean }

// Returns what it did, for the log.
export function postCheckResult(tracker: Tracker, cr: ChangeRequest, problems: Problem[], opts: CheckCommentOptions = {}): string {
  const existing = tracker.changeComments(cr).find(n => n.body.includes(TAG));
  if (!problems.length && !existing) return "check passes; no comment to update";
  const c = (existing && cardIn(existing.body)) || drawCard(opts.rng);
  const vars = {
    card: c.html, card_name: c.name, card_url: c.url, sha: cr.head.slice(0, 7), count: problems.length,
    problems: problemList(problems, (file, line) => tracker.fileUrl(file, cr.head, line)),
  };
  const body = `${render(loadTemplate(problems.length ? "check-failed" : "check-passed", opts.templates), vars)}\n\n${TAG}`;
  if (existing?.body.trim() === body.trim()) return "check comment already current";
  if (opts.dryRun) return `would ${existing ? "update" : "post"} the check comment`;
  if (existing) tracker.editComment(cr, existing.id, body);
  else tracker.commentOnChange(cr, body);
  return `${existing ? "updated" : "posted"} the check comment`;
}
