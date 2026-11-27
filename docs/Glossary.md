Each name below says first what the thing does. The archetype names come from Jung; you don't need the background to use them.

## The cast

The cast is the set of agent roles. Each role is a prompt file in `docs/roles/`, run by your agent harness.

| Name | What it does |
|---|---|
| Self | You. You decide what work exists, approve specs by merging them, and review the PRs the cast raises. |
| Magician | Parked. Proposes what to spec next, from a project's issues, specs and Now page. Runs as the `propose` skill. |
| Ruler | Writes the spec and plan for one issue with you, in your session. Can send out an Explorer, a Sage or a Shadow to help. |
| Explorer | Answers questions about the code: reads files and returns paths and line numbers. Changes nothing. |
| Sage | Proposes how to do something and in what order, with its reasons. Changes nothing. |
| Creator | Writes the code for one task, runs the tests and reports. |
| Shadow | Reviews the Creator's diff against the spec's acceptance criteria and the domain's invariants, with fresh context. Returns a verdict per criterion. |
| Trickster | Runs the criteria the Shadow couldn't settle by reading, and tries to make them fail. |

## Documents

All of these live in the project repo.

| Name | What it is |
|---|---|
| Domain | An area of the code with its own rules, such as `billing`. Every spec belongs to one. |
| Persona | `docs/personas/<domain>.md`: the domain's scope, its invariants, and how to run things there. Any role reads it first to work in that domain. Not a user persona. |
| Invariant | A rule the domain must never break, with an id like `billing/I2`. Every plan states for each one whether it still holds. A proposed invariant is one a review turned up, waiting for you to promote or delete. |
| Spec | `docs/specs/<domain>/<behaviour>.md`: what one behaviour does and why, with its acceptance criteria. A spec describes the behaviour, not a change to it, so later changes edit the same file. It never says how. |
| Acceptance criterion | One checkable claim in a spec, with an id like `AC3`. An after-deploy criterion (`AC6 (after deploy):`) can only be checked in production. |
| Plan | `docs/specs/<domain>/<behaviour>.plan.md`: how one change to a spec gets built. Approach, contracts, invariants and tasks. Deleted once the change is done. |
| Open question | A `[NEEDS CLARIFICATION: ...]` marker in a spec or plan, where the Ruler couldn't decide. The spec can't merge until each one is answered. |
| Tier | How much writing a change needs. Trivial: the criteria go in the issue body, with no spec or plan. Designed: a spec and a plan, in a spec PR. |

## Work

| Name | What it is |
|---|---|
| Issue | One piece of work, on the tracker (GitHub Issues). Its label says its state: `needs-spec`, `ready-for-agent`, `ready-for-human` or `verifying`. |
| Spec PR | The PR on branch `spec/<issue>` that adds or edits a spec and adds its plan. Merging it is the approval. |
| Task | One unit of a plan that one Creator builds, keyed `gh-<issue>/t1`. Its PR's title starts with the key and its body says `Refs #<issue>`, so the merge job can tell when every task is done. |
| Vessel | One agent session, in its own worktree, that carries a task from start to PR. |
| Runner | What runs vessels: Alice when it's installed, or a `/build` session you start. Without Alice, tasks are printed for you to start. |
| Tracker | Where issues and PRs live. GitHub is the only one so far. |

## Tools

| Name | What it does |
|---|---|
| `check-spec` | Checks every spec and plan, in CI and locally. On a PR it comments why it fails. |
| `spec-to-tasks` | Turns an issue's plan (or a trivial issue's body) into tasks for the runner. |
| `on-merge` | After a spec PR merges, moves its issue to `ready-for-agent` and runs `spec-to-tasks`. |
| `task-merged` | After a task PR merges, checks whether every task of its issue has merged. If so, marks the spec `built`, removes the plan, and closes the issue or moves it to `verifying`. |
| `questions` | Posts each open question on a spec PR as a review comment, and writes your reply into the spec. |
| Now page | `🌀 Now/<project>.md` in an Obsidian vault: what's waiting on you, stuck, in flight and ready, rebuilt by `status-page`. Parked. |
