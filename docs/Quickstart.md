This takes one change from an issue to a merged PR. Words you haven't met are in the [Glossary](Glossary.md).

## Before you start

You need:

- Node 24 and git.
- The GitHub CLI, logged in: `gh auth status` shows your account.
- A repo on GitHub that you can push to and merge PRs into.
- This repo cloned somewhere, for example `~/code/unconscious-development`. The commands below call `bin/unconscious` from there.

An agent harness is optional. The cast runs in Claude Code or in pi:

- Claude Code: `bin/unconscious enable --harness claude` writes the roles into `~/.claude/agents/` and the skills into `~/.claude/skills/`. Start a role as the main agent with `claude --agent ruler` or `claude --agent creator`, so it can send out the others. Set `UD_HARNESS=claude` for the headless commands (`draft`, `propose`).
- pi, with the pi-subagents package: `bin/unconscious enable`.

Without either, you write specs by hand and start each task yourself, and everything else here works the same.

## Set up your repo

1. From your repo's root, run `~/code/unconscious-development/bin/unconscious init --domain <name>`. Pick a domain for the area of code your first change touches, such as `billing`. It creates:
   - `docs/specs/`, where specs live.
   - `docs/personas/<name>.md`, a draft Persona.
   - `.github/workflows/unconscious.yml`, which runs `check-spec` on spec PRs and creates tasks when a spec merges.
   - `.github/workflows/unconscious-tasks.yml`, which closes the issue when its last task's PR merges.
2. Draft the Persona: what the domain covers, and its invariants, the rules a change there must never break. With the cast, ask your agent to "draft the `<name>` persona"; the persona skill reads the code and proposes invariants with their sources, and you strike what's wrong. By hand, two or three invariants are enough. A draft is enough to start: `check-spec` warns until you set `status: confirmed`.

   The Persona then grows on its own. When the Shadow reviews a change and finds a rule the code relies on that the Persona doesn't list, the Creator adds it under Proposed invariants in that PR, and you promote or delete it.
3. Commit the files on a branch, open a PR, and merge it.

## Your first change

1. Open an issue that says what should change and why, and label it `needs-spec`.
2. Decide the tier. If the change is one task with no design choice (a constant, copy, a config flag), it's trivial: go to [A trivial change](#a-trivial-change). Otherwise it's designed: continue here. If it's a change you'd rather just make yourself, skip UD: open a normal PR, with no issue or criteria.
3. Create a branch named `spec/<issue number>`.
4. Write the spec and plan. With the cast, ask your pi session to use the spec skill on the issue; the Ruler drafts both with you. By hand, copy `skills/spec/templates/spec.md` to `docs/specs/<domain>/<behaviour>.md` and `plan.md` to `<behaviour>.plan.md` beside it, and fill them in. The spec's `issues` and the plan's `issue` are the issue's URL.
5. Where you can't decide something yet, write `[NEEDS CLARIFICATION: <question>]` at the spot the answer belongs.
6. Run `~/code/unconscious-development/bin/unconscious check-spec` until it reports only your open questions, then push and open the PR. CI runs the same check and leaves a comment on the PR saying why it fails.
7. Answer each open question by replacing its marker in the file and pushing.
8. When no questions remain, set the spec's `status: approved` and merge the PR. The workflow moves the issue to `ready-for-agent` and lists the plan's tasks in its job log.

Then go to [Do the tasks](#do-the-tasks).

### A trivial change

1. Get criteria into the issue body: one `- AC1: <claim>` line per thing a reviewer could check, under `## Acceptance criteria`. With the cast, run `bin/unconscious draft <number>` from your repo, or ask your agent to spec the issue; the Ruler writes them and comments asking for your approval. By hand, write them and run `bin/unconscious check-spec --issue <number>`.
2. Read the criteria, edit any that are wrong, and add the `ready-for-agent` label. That's the whole approval. The workflow lists the issue's one task in the job log.

### Exploring first

When you don't know what to build yet, skip the spec and explore in a chat session on a branch. When you're happy with it, ask the Ruler to "spec what we built" (`claude --agent ruler`, or the spec skill in pi). It writes the spec's criteria from the branch's diff, has the Shadow check the code meets them, and adds any rules you discovered to the Persona's proposed invariants. The spec lands as `built` in the same PR as the code.

## Do the tasks

Each task has a key like `gh-42/t1` and a body with its criteria.

1. Start an agent session in a new worktree and give it the task body. With the cast, start it as the Creator (`claude --agent creator` in Claude Code); it builds the task and has the Shadow review the diff against the criteria. Without it, do the work yourself.
2. Open a PR whose title starts with the task key, like `gh-42/t1: Add the bulk archive mutation`, and whose body says `Refs #<issue>`. Don't write `Closes`, since a plan can have more tasks.
3. Review and merge it.

When the last task's PR merges, the workflow marks the spec `built`, removes the plan, and closes the issue. If the spec has after-deploy criteria, the issue moves to `verifying` instead and stays open until you've checked them in production. If your default branch refuses pushes from GitHub Actions, the spec change arrives as a PR for you to merge.

## Optional extras

- **Questions in PR threads.** `bin/unconscious questions --pr <number>` posts each open question as a review comment on its line. Reply in the thread and the next run writes your answer into the spec and commits it. A reply in quotes goes in as written. A plain-words reply needs pi to read it. On macOS, `bin/unconscious schedule on` runs this every 2 minutes for every project with a Now page.
- **Now pages.** In an Obsidian vault, a `🌀 Now/<project>.md` page with `repo: <owner>/<repo>` in its frontmatter gets rebuilt by `bin/unconscious status-page`, showing what's waiting on you, stuck, in flight and ready. Set `UD_NOW_DIR` to that folder.
- **The Magician.** `bin/unconscious propose` writes the Proposed next section of each Now page.
- **Bakery.** To have tasks become Bakery cards instead of job-log lines, run the workflow on a runner that can reach your board, and set `UD_RUNNER: bakery` and `BAKERY_URL` in it.
- **Updating.** The workflow pins one commit of this repo in `UD_REF`. To pick up changes, set it to a newer commit.
