---
status: accepted
proposed: 2026-11-17
revised: 2026-11-27
revises: "[[Unconscious Development]]"
---

UD is the method: Personas, specs, plans, tasks, and review against the criteria. Two tools sit beside it, and each one works without the other two.

| Tool | Job | Depends on |
|---|---|---|
| Alice | Runs agents. One card per task in its own worktree, a review gate, and the cost of each run. | Impression, optionally |
| Impression | Remembers. Preferences, history, gotchas, and facts that span repos. | Nothing |
| UD | The method. Specs and criteria in the repo, tasks to PRs, and review against the criteria. | Alice and Impression, both optionally |

Alice never learns UD's concepts. To Alice, a task key like `gh-42/t1` is an opaque `--key`, and Alice writes it into the footer of every PR it opens.

## Where state lives

| Owner | Owns |
|---|---|
| The tracker (GitHub today) | Work state: issues and their labels, PRs, and checks |
| The repo | Specs, plans, Personas, and `AGENTS.md` |
| The runner | A task's stage (queued, running, blocked, or retried) and its cost |

UD reaches the tracker only through `src/tracker/`. GitHub is the only tracker so far, and code outside that folder doesn't assume it.

A task is done when a merged PR names its key, or when its box in the plan is ticked. `task-merged` reads that to finish the issue. The runner's state is progress up to the PR, never the answer to "is it done?". Each runner reports stage its own way: Alice through `alice --json`, and a `/build` session through its branch.

## Rules and memories

- A rule a reviewer checks against a diff is a Persona invariant.
- How to run or build something goes in `AGENTS.md`.
- Preferences, history, gotchas, and facts that span repos live in Impression. A memory that reads like an invariant becomes a proposed invariant in the Persona.

Alice sets `IMPRESSION_SESSION` on every Pi process it starts. Card runs get `read`, so they get memories but never upload their transcripts. Reviewers get `off`, so they judge from the card, the diff, and the repo alone.

## Runners and review

- `spec-to-tasks` creates Alice cards when Alice is installed. `/build` claims the task's card before it starts, and refuses when the card is already running.
- On Alice, Alice's reviewer is the only gate. The task body carries the criteria and invariants, and the review model comes from a different model family than the author's.
- `/build` runs the Creator, the Shadow, and the Trickster in one session.

## Parked

- The Magician, `propose`, `status-page`, the vault mirror, and the `schedule` timers. The code stays, and the timers are off until the vault's role is decided.
- Whether Impression's memories would help reviewers. Revisit it when a review misses something a memory would have caught.
