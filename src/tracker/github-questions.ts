// The GitHub side of open questions: review comments on a PR, and committing an answer to its
// branch. The rules live in ../questions.ts.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  answerablePath, applyAnswer, mayAnswer, normaliseAnswer, parseQuestionTag, questionBody, questionsIn, unasked,
  type Question,
} from "../questions.ts";

const run = (cmd: string, args: string[], cwd?: string) =>
  execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const gh = (args: string[]) => run("gh", args);
const ghJson = (args: string[]) => JSON.parse(gh(args));

interface ReviewComment {
  id: number;
  body: string;
  path: string;
  in_reply_to_id?: number;
  author_association: string;
  user: { login: string; type: string };
}

function comments(repo: string, pr: number): ReviewComment[] {
  const out = gh(["api", "--paginate", `repos/${repo}/pulls/${pr}/comments`, "--jq", ".[] | @json"]);
  return out ? out.split("\n").map(l => JSON.parse(l)) : [];
}

function prInfo(repo: string, pr: number): { head: string; branch: string; files: string[] } {
  const j = ghJson(["pr", "view", String(pr), "-R", repo, "--json", "headRefOid,headRefName,files"]);
  return { head: j.headRefOid, branch: j.headRefName, files: j.files.map((f: any) => f.path).filter(answerablePath) };
}

function fileAt(repo: string, path: string, ref: string): string | null {
  try {
    const b64 = gh(["api", `repos/${repo}/contents/${path}?ref=${ref}`, "--jq", ".content"]);
    return Buffer.from(b64, "base64").toString("utf8");
  } catch {
    return null; // deleted in this PR
  }
}

function openQuestions(repo: string, files: string[], ref: string): Question[] {
  return files.flatMap(path => {
    const text = fileAt(repo, path, ref);
    return text === null ? [] : questionsIn(path, text);
  });
}

function post(repo: string, pr: number, head: string, q: Question) {
  const base = ["api", "-X", "POST", `repos/${repo}/pulls/${pr}/comments`, "-f", `body=${questionBody(q)}`, "-f", `commit_id=${head}`, "-f", `path=${q.path}`];
  try {
    gh([...base, "-F", `line=${q.line}`, "-f", "side=RIGHT"]);
  } catch {
    // The marker's line is outside the diff: comment on the file instead, which still threads.
    gh([...base, "-f", "subject_type=file"]);
  }
}

// Ask every open question on the PR that no comment has asked yet. Returns how many were posted.
export function askQuestions(repo: string, pr: number, dryRun = false): number {
  const { head, files } = prInfo(repo, pr);
  const fresh = unasked(openQuestions(repo, files, head), comments(repo, pr).map(c => c.body));
  for (const q of fresh) {
    if (dryRun) console.log(`would ask ${q.path}:${q.line} ${q.marker}`);
    else { post(repo, pr, head, q); console.log(`asked ${q.path}:${q.line} ${q.marker}`); }
  }
  if (!fresh.length) console.log("no unasked questions");
  return fresh.length;
}

const reply = (repo: string, pr: number, id: number, body: string) =>
  gh(["api", "-X", "POST", `repos/${repo}/pulls/${pr}/comments/${id}/replies`, "-f", `body=${body}`]);

// Apply a reply to a question comment: replace the marker in the checked-out branch at `root`,
// commit, push, and say so in the thread. Anything that isn't a permitted answer is ignored.
export function answerQuestion(
  root: string, repo: string, pr: number, commentId: number, opts: { self: string[]; dryRun?: boolean },
): string {
  const c = ghJson(["api", `repos/${repo}/pulls/comments/${commentId}`]) as ReviewComment;
  if (!c.in_reply_to_id) return "not a reply; ignored";
  const parent = ghJson(["api", `repos/${repo}/pulls/comments/${c.in_reply_to_id}`]) as ReviewComment;
  const tag = parseQuestionTag(parent.body);
  if (!tag || parent.user.type !== "Bot") return "not a reply to an open question; ignored";
  if (!mayAnswer(c.user, c.author_association, opts.self)) return `${c.user.login} may not answer; ignored`;
  if (!answerablePath(tag.path)) return `refusing to edit ${tag.path}`;

  const answer = normaliseAnswer(c.body);
  if (!answer) return "empty reply; ignored";
  const file = join(root, tag.path);
  const next = applyAnswer(readFileSync(file, "utf8"), tag.marker, answer);
  if (next === null) {
    if (!opts.dryRun) reply(repo, pr, parent.id, "This question is no longer in the file, so the reply changed nothing.");
    return "marker already gone";
  }
  if (opts.dryRun) return `would replace ${tag.marker} in ${tag.path} with: ${answer}`;

  const { branch, files } = prInfo(repo, pr);
  writeFileSync(file, next);
  run("git", ["add", "--", tag.path], root);
  run("git", ["-c", "user.name=github-actions[bot]", "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com",
    "commit", "-q", "-m", `Answer an open question in ${tag.path}`, "-m", `${tag.marker}\n\n→ ${answer}\n\nAnswered by @${c.user.login}.`], root);
  run("git", ["push", "-q", "origin", `HEAD:${branch}`], root);
  const sha = run("git", ["rev-parse", "HEAD"], root);

  const left = files.flatMap(path => {
    try { return questionsIn(path, readFileSync(join(root, path), "utf8")); } catch { return []; }
  }).length;
  reply(repo, pr, parent.id, left
    ? `Answered in ${sha.slice(0, 7)}. ${left} open question${left === 1 ? "" : "s"} left on this PR.`
    : `Answered in ${sha.slice(0, 7)}. No open questions left; set \`status: approved\` in the spec when you approve it.`);
  askQuestions(repo, pr); // an answer may itself hold a new marker
  return `answered ${tag.path} in ${sha.slice(0, 7)}`;
}
