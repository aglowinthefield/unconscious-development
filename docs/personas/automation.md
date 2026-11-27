---
domain: automation
owner: Tom
status: draft
---

## Scope

The parts of Unconscious Development that run without anyone watching: the questions poller (`unconscious questions`, on a timer), the project workflows (`check-spec`, `on-merge`, `spec-to-tasks`, `task-merged`), and the GitHub tracker they all write through.

## Invariants

What this domain refuses. Each id is written in full as `automation/I1` elsewhere. Ids are permanent; a retired invariant keeps its id out of use.

| Id | Rule | Sources |
|---|---|---|
| I1 | A commit to a spec branch is written against the head its content was built from, so it never replaces a change it didn't read. A stale write gets a 409 and is retried on the next pass. Before this, the poller reverted a Ruler push made while it ran. | [github.ts](https://github.com/aglowinthefield/unconscious-development/blob/main/src/tracker/github.ts#L185)<br>[questions.ts](https://github.com/aglowinthefield/unconscious-development/blob/main/src/questions.ts#L267) |
| I2 | Every push to the default branch gets its own `task-merged` run, since each run handles only the PRs its push merged. A cancelled run leaves its issues open for good. | [unconscious-tasks.yml](https://github.com/aglowinthefield/unconscious-development/blob/main/workflows/unconscious-tasks.yml#L32) |
| I3 | Every open `[NEEDS CLARIFICATION]` marker on an open spec PR gets its own question thread. Questions are keyed by file and marker text, so check-spec refuses two identical markers in one file. | [questions.ts](https://github.com/aglowinthefield/unconscious-development/blob/main/src/questions.ts#L125)<br>[spec.ts](https://github.com/aglowinthefield/unconscious-development/blob/main/src/spec.ts#L191) |
| I4 | An issue in `ready-for-agent` with an approved plan has a task for every unticked plan task. Creating tasks is safe to repeat, so a rerun creates what's missing instead of skipping the issue. | [cli.ts](https://github.com/aglowinthefield/unconscious-development/blob/main/src/cli.ts#L146)<br>[bakery.ts](https://github.com/aglowinthefield/unconscious-development/blob/main/src/runner/alice.ts#L4) |
| I5 | A comment never blocks a state change. A failed comment is logged, and the label change or close still happens. | [task-merged.ts](https://github.com/aglowinthefield/unconscious-development/blob/main/src/task-merged.ts#L202) |
| I6 | The tracker is the only record of what the poller has done. Every comment it posts carries a `ud-question` or `ud-reply` tag, and a pass with nothing new changes nothing. | [questions.ts](https://github.com/aglowinthefield/unconscious-development/blob/main/src/questions.ts#L5)<br>[questions.ts](https://github.com/aglowinthefield/unconscious-development/blob/main/src/questions.ts#L289) |

## Proposed invariants

- Two check-spec runs on one PR post one check comment between them. Today two quick pushes can each find no comment and post one, and later runs update only the first. Needs a per-PR concurrency group on the `check-spec` job to confirm.

## Standing questions

- Can two copies of this step run at once: a second machine with the schedule on, a manual run, or two pushes in quick succession? What does the second one see?
- If the step fails halfway, does its rerun finish the job or skip it?

## Cost model

`questions` makes about four `gh` calls per open PR every 2 minutes, plus one small model call per plain-words reply. The workflows run on GitHub-hosted runners, once per spec PR push and once per push to the default branch.

## Key files

- `src/questions.ts`: the questions poller
- `src/tracker/github.ts`: every write to GitHub
- `src/task-merged.ts`: marks specs built and closes issues
- `src/cli.ts`: `on-merge` and `spec-to-tasks`
- `workflows/`: the workflows `unconscious init` copies into a project

## Recent decisions

- [#30](https://github.com/aglowinthefield/unconscious-development/pull/30): the 2026-11-26 state review found the lost-update and dropped-run bugs behind I1 to I5, and fixed them.

## How to run things here

- `npm test`, `npm run typecheck` and `npm run lint`. CI runs all three.
- For GitHub behaviour (409s, review threads, workflow concurrency), use the private scratch repo `aglowinthefield/ud-state-scratch`. Never use a project repo.
- For ordering questions, write a TLA+ model and run `timeout 300 npx -y everystate@0.4.1 Flow.tla`, as the Trickster's role says.
