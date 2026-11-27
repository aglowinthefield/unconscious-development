---
name: build
description: "Build an approved spec's next task in this session. Takes an issue id, picks the next task from its plan, opens the task's worktree (stacked on an unmerged parent), sends a Creator, then a Shadow and a Trickster, and opens the task's PR. Use when the user says \"/build 6983\", \"build 6983\", \"build gh-6983/t2\", \"do the next task of 6983\", or wants an approved spec's tasks done without Alice."
---

# Build

Takes an approved issue to one task's PR, from an interactive session. You dispatch; a Creator writes the code, a Shadow judges it, a Trickster runs what reading can't settle. One task per run, then stop and report. Running this skill is the Self's go-ahead to send those subagents.

## 1. Find the issue and its tasks

The argument is an issue (`6983`, `owner/repo#6983`, a URL), optionally with a task (`t2`, `gh-6983/t2`). Find the repo and checkout as the `issue` skill's step 1 does.

From the checkout's main worktree, `git fetch origin`, then run `unconscious spec-to-tasks <n> --runner session --repo <repo>` (`bin/unconscious` in the repo this skill belongs to: `readlink -f` this skill's directory, then up two). It refuses unless the issue is `ud:build` and its spec is approved and passes `check-spec`; if it refuses, say why and stop. Each task it prints starts `===== gh-<n>/tK: <title>`, may have a `Start after:` line, and the rest is the task's body.

## 2. Pick the task

For each key, find its PR: `gh pr list -R <repo> --state all --search "gh-<n>/tK in:title" --json number,state,headRefName,baseRefName,title`. A task is done when its PR is merged.

- A task named in the argument: take it.
- Otherwise the first task, in plan order, that isn't done.
- If the task has an open PR, you resume it (step 7). Say so.
- If every task is done, say so and stop.

Then check its `Start after:` parents:

- All merged: base is `origin/main`.
- Exactly one unmerged, with an open PR: stack. Base is that PR's branch, and the PR you open targets it.
- An unmerged parent with no PR, or two unmerged parents: refuse, and name the parent to build first.

## 3. Open the worktree

`git worktree add .worktrees/gh-<n>-tK -b gh-<n>/tK <base>` from the checkout's main worktree, or reuse the worktree or branch if it exists. Run the repo's post-create steps from its `AGENTS.md` (dependencies, secrets preflight). Use absolute paths into the worktree from here on. Never edit the main checkout.

Before you send anyone, tell the Self in three lines at most: the task key and title, the base (main, or the parent PR it stacks on), the worktree path.

## 4. Send the Creator

Send one Creator subagent (`creator`) with the task's body, the worktree path, and these overrides of the body's last paragraph: commit in the worktree, don't push or open a PR, and don't summon a Shadow, since you will. Wait for its report.

## 5. Send the Shadow, then the Trickster

Send a Shadow (`shadow`) with the task's criteria (its `## Criteria` section, plus its `## Invariants` line and the Persona path) and the worktree path, and tell it the diff is `git diff <base>...HEAD` there. Give it nothing from the Creator's report. Where the harness can reach another model family, send the Shadow and Trickster on it, as `docs/roles/Roles.md` says.

- `unmet`: send the Creator again with those criteria and the Shadow's evidence, then the Shadow again. Two rounds at most; after that, stop and report what's still unmet.
- `needs-run` and ordering questions: send a Trickster (`trickster`) with those criteria and questions, the Shadow's instructions for each, the worktree path and the Persona path. A `fail` goes back to the Creator like an `unmet`; a `blocked` goes in the report.
- Proposed invariants: the Creator adds them to the Persona, as its role says.

## 6. Open the PR

Push `gh-<n>/tK` and open one ready PR against its base from step 2.

- Title: the task key first (`gh-42/t1: …`). If the repo's PR title rule needs a prefix such as `type(scope):`, put the key right after it (`feat(feeds): gh-42/t1 …`), and run the repo's title check before calling GitHub.
- Body: the repo's PR template, `Refs #<n>` and never `Closes`, the Shadow's verdicts per criterion, the Trickster's results, and what wasn't run. When stacked, say `Stacked on #<parent PR>`: it merges after the parent, and GitHub retargets it to the default branch once the parent's branch is deleted.
- Follow the repo's own PR rules (verify command, screenshots) where they apply.

If the push or PR fails, stop and report it. Never merge or queue.

## 7. Resume

On a task that has an open PR: reuse its worktree and branch, read its review threads and failed checks, send the Creator with what they ask for, then step 5 for the criteria the change touches, and push to the same PR. If its stacked parent has merged since, rebase onto `origin/main` first (`git rebase --onto origin/main <parent branch>`) and retarget the PR if GitHub hasn't.

## 8. Report

The task and PR link, its base, each criterion's verdict, anything blocked or unmet, and the next task this issue has (or that it was the last). Then stop. The Self runs `/build <n>` again for the next one.

If the task fixed stored data that broke a rule the code assumed (it needed a backfill, merged two definitions of one rule, routed a write through a normalizer, fixed a collation fold, a stale reader or twins), run the `data-hygiene` skill in sweep mode for that rule before you report, and put its report path in yours. It's read-only and files nothing.

When you name a criterion or task (`AC13`, `t5`), say what it is in a few words the first time.
