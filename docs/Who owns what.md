---
status: needs-review
proposed: 2026-11-17
revises: "[[Unconscious Development]]"
---

Work lives on GitHub, and specs live in your repo. That's all a new user needs: issues, PRs and labels where they already are, and specs, plans and Personas as Markdown files beside the code.

Two add-ons are optional, and neither holds anything you can't find on GitHub or in the repo, apart from your planning notes:

- Obsidian, for planning across projects. Its notes show copies of GitHub's state next to your own planning. Properties starting `gh_` or `run_` are copies and get overwritten; everything else is yours.
- A runner like Bakery, for tasks the cast does without you. Without one, a task is a session you start.

The rest of this note is how UD decides what to copy where, for whoever works on UD itself. It fixes a real problem: today the same piece of work shows up as a GitHub label, a PR thread, a Now-page line written only in the vault, and `Specs.base` reading whatever branch the local clone has checked out, and nothing says which copy is current. [[Development flow]] draws it.

## How UD decides what to sync

Each kind of state has one owner. Everywhere else it appears is a copy, marked as one and stamped with when it was copied. UD stays tied to GitHub and Obsidian; splitting them into adapters waits until UD is released, if ever.

| Owner | Owns | Examples |
|---|---|---|
| GitHub | Work state | Issues and their state labels, PRs, checks, question threads, the check comment |
| The repo | What and how | Specs, plans, Personas |
| The runner (optional) | Execution | A task's stage (queued, running, blocked, retried) and its cost |
| Obsidian (optional) | Planning | The Magician's dreams and judgments, which day work is for, your own notes |

A task's key, `gh-42/t1`, ties these together: the issue on GitHub, the task line in the plan, the card or session in the runner, and the PR whose title starts with the key.

A task is done when a merged PR names its key, or when its box in the plan is ticked. That is built: `task-merged` reads it to finish the issue. The runner's own state for a task is progress up to the PR, never the answer to "is it done?".

## In the vault

`status-page` stops writing lists into the Now page and writes one note per open issue and spec PR instead, under `🌀 Now/<project>/`. Bases views group them across projects: Waiting on you, Stuck, In flight, Ready, Dreams. The Now page becomes a short summary that embeds those views.

Two owners share each note, and the property names say which is which:

- `gh_` properties (`gh_state`, `gh_checks`, `gh_pr`, `gh_url`) and `run_` properties (`run_stage`, `run_spend`) are copies. Each sync rewrites them and sets `synced_at`. Edit them and the next sync puts them back.
- Every other property, and the note's body, belongs to you and the Magician: `autonomy`, `size`, `stacks_on`, `day`, notes. Sync never touches them.

A note whose issue closes keeps its planning properties and moves to `🌀 Now/<project>/done/`, so a later dream can cite how similar work went. `Specs.base` reads specs from `main` through these notes rather than through the symlinked working copy.

## Dreams

A dream is the Magician's proposal: a vault note with no `gh_state`, a short pitch, and the Magician's judgments (feasibility, what it stacks on, how much autonomy it can have).

- You affirm one by creating its issue, from the note or with `gh issue create`. The next sync fills in its `gh_` properties.
- You reject one by deleting it, or by setting `rejected: <why>` so the Magician doesn't propose it again.

Dreams live only in the vault. They are planning, and planning is Obsidian's.

## Runners by autonomy

The Magician's `autonomy` judgment picks the runner when a task is handed out:

- `full`: Bakery or a headless agent. You see only the PR.
- `assisted`: an interactive session in the task's worktree, opened with the task body, for work that needs you partway.
- `manual`: you, by hand.

Every runner names the task's branch after its key (`task/gh-42-t1`), so a runner that reports nothing still shows its stage: no branch means queued, a branch means in progress, an open PR means in review, and a merged PR means done. Bakery adds blocked, retries and cost on top.

## What this changes in the design doc

- "One vault page per project": the page becomes a summary over per-item notes.
- "The Magician's contract is its inputs and the page it writes": it writes dream notes and the planning properties of item notes.
- "Bakery is the first runner": runner choice comes from the item's `autonomy`.

## Build order

1. `status-page` writes item notes with `gh_` properties and `synced_at`, plus the Bases views. The Now page's owned sections become embeds.
2. The `propose` skill writes dreams as notes and sets planning properties on item notes.
3. `run_` properties from Bakery, and the key-named branch convention in the Creator's prompt and `spec-to-tasks`.
4. Runner choice from `autonomy` in `spec-to-tasks`.

## Open

1. Should item notes cover only issues UD manages (they carry a state label), or every open issue? Proposed: only managed ones, plus open spec PRs.
2. How long do done notes stay? Proposed: forever. They're small, and they're the Magician's record of how work went.
