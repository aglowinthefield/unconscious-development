// The vault's copy of a project's specs and Personas: two symlinks in the project's vault folder,
// pointing into a worktree of the repo that status-page keeps detached at origin/main. The vault then
// shows what's merged, not whatever branch the local clone has checked out, and edits made there
// can't land in the checkout other sessions work in. Opt in with `vault: <folder>` on the Now page.

import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readlinkSync, symlinkSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const LINKS: [string, string][] = [["Specs", "docs/specs"], ["Personas", "docs/personas"]];

const git = (args: string[], cwd: string) =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

// Outside the repo, so worktree sweeps that clear merged worktrees under .worktrees/ leave it alone.
export const mirrorDir = (repo: string) =>
  join(process.env.UD_MIRROR_DIR ?? join(homedir(), ".local/share/unconscious/mirrors"), ...repo.split("/"));

// Bring the mirror to origin/main, creating it on first use. Expects origin/main already fetched.
// Returns a problem, or null when the mirror is current.
export function syncMirror(checkout: string, mirror: string): string | null {
  if (!existsSync(mirror)) {
    git(["worktree", "prune"], checkout); // a mirror deleted by hand leaves its registration behind
    mkdirSync(dirname(mirror), { recursive: true });
    git(["worktree", "add", "-q", "--detach", mirror, "origin/main"], checkout);
    return null;
  }
  let dirty: string;
  try { dirty = git(["status", "--porcelain"], mirror); }
  catch { return `${mirror} isn't a worktree; delete it and the next run recreates it`; }
  if (dirty) return `${mirror} has local edits, so the vault's specs stopped following main. Move them into a spec PR, then \`git -C ${mirror} checkout -- .\``;
  git(["checkout", "-q", "--detach", "origin/main"], mirror);
  return null;
}

// Point the vault folder's Specs and Personas at the mirror. Never replaces a real file or folder.
export function linkVault(folder: string, mirror: string): string[] {
  const problems: string[] = [];
  for (const [name, rel] of LINKS) {
    const target = join(mirror, rel);
    if (!existsSync(target)) continue; // the repo has none yet
    const link = join(folder, name);
    let stat;
    try { stat = lstatSync(link); } catch { stat = null; }
    if (stat && !stat.isSymbolicLink()) {
      problems.push(`${link} is a real folder, so it wasn't linked to ${rel}. Move what's in it into the repo, then delete it`);
      continue;
    }
    if (stat && readlinkSync(link) === target) continue;
    if (stat) unlinkSync(link);
    mkdirSync(folder, { recursive: true });
    symlinkSync(target, link);
  }
  return problems;
}

// The whole step for one project page: problems to list under Last updated.
// Obsidian Sync doesn't carry symlinks, so the links are per machine. A host that only writes the
// Now pages (UD_VAULT_MIRROR=off) leaves them to the machine you read the vault on, which runs
// `unconscious mirror` instead.
export function syncVault(fm: Record<string, unknown>, vaultRoot: string): string[] {
  if (process.env.UD_VAULT_MIRROR === "off") return [];
  if (typeof fm.vault !== "string" || typeof fm.path !== "string" || typeof fm.repo !== "string") return [];
  const checkout = fm.path.replace(/^~(?=\/)/, homedir());
  if (!existsSync(checkout)) return [];  // gather already says the path is missing
  const mirror = mirrorDir(fm.repo);
  try {
    const problem = syncMirror(checkout, mirror);
    return [...(problem ? [problem] : []), ...linkVault(join(vaultRoot, fm.vault), mirror)];
  } catch (e: any) {
    return [`the vault mirror failed: ${String(e.stderr || e.message).split("\n")[0]}`];
  }
}
