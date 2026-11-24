// Which project pages need the Magician again: those whose Do next is done. status-page runs this
// every 15 minutes, so a finished pick gets a new proposal for that project without waiting for the
// daily run. Only GitHub decides "done" (every issue on the Do next line closed, every PR merged or
// closed); a pick nobody closes waits for the daily run.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { parseDoc, section } from "./markdown.ts";
import { projectPages } from "./status.ts";

const URL_RE = /https:\/\/github\.com\/([^/\s]+\/[^/\s]+)\/(?:issues|pull)\/(\d+)/g;

// The issue and PR URLs on the Do next callout line, in order, without repeats.
export function doNextUrls(page: string): string[] {
  const body = section(parseDoc(page), "Proposed next")?.body ?? "";
  const line = /^>\s*\[!tip\][^:\n]*:(.*)$/m.exec(body)?.[1] ?? "";
  return [...new Set([...line.matchAll(URL_RE)].map((m) => m[0]))];
}

// True when GitHub says the issue or PR is closed (a merged PR is closed too).
export function closedOnGitHub(url: string): boolean {
  const [, repo, n] = new RegExp(URL_RE.source).exec(url)!;
  const state = execFileSync("gh", ["api", `repos/${repo}/issues/${n}`, "--jq", ".state"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  return state === "closed";
}

export const stateFile = () =>
  join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state"), "unconscious/propose-due.json");

// Pages whose Do next is all closed and hasn't triggered a run yet. Each Do next fires once: the
// state file keeps the URLs that last fired per page, so a failed or slow run isn't started again
// every 15 minutes. A check that errors (offline, no access) counts as not done.
export function dueProjects(dir: string, state = stateFile(), closed = closedOnGitHub): string[] {
  const fired: Record<string, string> = existsSync(state) ? JSON.parse(readFileSync(state, "utf8")) : {};
  const due: string[] = [];
  for (const { file, text } of projectPages(dir)) {
    const urls = doNextUrls(text);
    const key = urls.join(" ");
    const page = basename(file, ".md");
    if (!urls.length || fired[page] === key) continue;
    const done = urls.every((u) => {
      try {
        return closed(u);
      } catch {
        return false;
      }
    });
    if (!done) continue;
    fired[page] = key;
    due.push(page);
  }
  if (due.length) {
    mkdirSync(dirname(state), { recursive: true });
    writeFileSync(state + ".tmp", JSON.stringify(fired, null, 2) + "\n");
    renameSync(state + ".tmp", state);
  }
  return due;
}
