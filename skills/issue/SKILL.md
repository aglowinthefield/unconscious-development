---
name: issue
description: Start the spec flow from an issue id. Finds the issue's repo and domain, opens the `spec/<issue>` worktree, and turns this session into that domain's Ruler. Use when the user says "/issue 6686", "issue 6686", "spec #6686", "start 6686", or gives an issue URL to spec.
---

# Issue

Takes an issue id to a Ruler drafting its spec, in this session. You set the stage; from step 5 on you are the Ruler.

## 1. Find the issue

The argument is a number (`6686`, `#6686`), `owner/repo#6686`, or an issue URL. With a bare number, the repo is the current directory's `origin` remote. Outside a project repo, take the repo and its checkout from the `🌀 Now/` pages (`$UD_NOW_DIR`, else `$DEV_VAULT/🌀 Now`, else `~/Documents/somewhere.garden/🌀 Now`): frontmatter `repo:` and `path:`. If more than one page could own the number, ask which.

Read it: `gh issue view <n> -R <repo> --json number,url,title,body,labels,state,comments`. Stop and say why when:

- it is closed;
- it is labelled `ready-for-agent` or `verifying`: its spec is already approved. Name the spec and ask whether the Self wants to edit it;
- it is labelled `ready-for-human`: a person is on it.

## 2. Find work already started

- A spec that lists the issue: `grep -rlw <n> <checkout>/docs/specs`, then check each hit's frontmatter `issues:`.
- A branch or PR: `git -C <checkout> ls-remote --heads origin spec/<n>` and `gh pr list -R <repo> --head spec/<n> --state all`.

If a spec PR is open, you resume it: same branch, same worktree, and read the PR's review threads for answered questions first. If one merged, say so and stop unless the Self asks for an edit.

## 3. Pick the domain

A `domain:<name>` label decides it. Otherwise read every Persona in `<checkout>/docs/personas/` (its intro and invariant table) and the issue, and pick the one whose ground the change stands on, not the one it merely mentions.

- One clear fit: take it and give the reason in one line.
- Two plausible: ask, naming both and what tips each.
- None: say so, and offer to draft a new Persona first (the `spec` skill's last section). Don't stretch a Persona to cover it.
- The Persona's `status` is `draft`: its invariants aren't confirmed, so stop after naming it and ask the Self to confirm them before any plan.

## 4. Open the worktree

From the checkout's main worktree, `git fetch origin`, then `git worktree add .worktrees/spec-<n> -b spec/<n> origin/main`. If the branch exists, add the worktree on it (`git worktree add .worktrees/spec-<n> spec/<n>`, after fetching it from `origin` if only the remote has it); if the worktree exists, use it. Every read, edit and command from here on uses absolute paths into that worktree. Never edit the main checkout.

## 5. Become the Ruler

Read the Ruler's role, `docs/roles/ruler.md` in the repo this skill belongs to (`readlink -f` this skill's directory, then up two). Follow it from now on in this session, with this task: issue `<repo>#<n>`, domain `<domain>`, worktree `<path>`. The Self drafts with you here, so don't hand the Ruler off to a child run; send Explorers and a Sage as the role allows.

Before drafting, tell the Self in three lines at most: the issue title, the domain and why, the worktree path, and whether you started fresh or resumed. Then follow the `spec` skill from its step 1.
