---
name: spec
description: Write or edit the acceptance criteria for a change, as issue criteria (trivial tier) or as a living spec plus a plan (designed tier), gated on the domain Persona's invariants. Use when specifying an issue, writing or editing docs/specs/, or turning an idea into something a Creator can build.
---

# Spec

A spec says what a behaviour does and why. A plan says how one change gets there. Neither says anything a Creator would have to guess at.

## 1. Pick the tier

Trivial: typo, constant, copy, config flag, or a net addition with no design choice. One task, no schema change, no new dependency. Write the criteria into the issue body yourself under `## Acceptance criteria` (`gh issue edit <n> --body-file`), keeping what the body already says above them, and run `unconscious check-spec --issue <n>`. Then comment on the issue: the criteria in one line each, and "Add `ready-for-agent` to hand this to the cast, or edit the criteria first." Adding that label is the Self's whole approval. No spec file, no plan.

A change the Self would rather just make by hand doesn't need UD at all: a normal PR, no issue, no criteria. Say so when an issue looks like that.

Everything else is designed: a spec in `docs/specs/<domain>/<behaviour>.md` and a plan beside it. If in doubt, it's designed.

## 2. Find or create the spec

Specs are living, one per behaviour (bulk archive, not "add a limit to bulk archive"). Search `docs/specs/<domain>/` first. If the behaviour has a spec, edit it: keep criterion ids, delete removed criteria outright, add new ids after the highest one. Otherwise copy `templates/spec.md` from this skill's directory.

Required sections, in order: Goal; Non-goals; Acceptance criteria; Setup note; Surfaces touched; Cost and scale. Frontmatter: `domain`, `status` (`draft` while any `[NEEDS CLARIFICATION]` marker is open, `approved` as soon as the last one is answered, `built` once its last task merges), `issues` (every issue that shaped it, append yours), `surfaces`.

Each criterion has an id (`AC1`, `AC2`, …) and one observable claim that a reader of the diff, or one run, could settle. Not "works well", "fast", "handles errors". Name the number, the state, the response. A claim only production can settle after the deploy (a rate over 24 h, a Sentry count) is marked `(after deploy)` after its id: `AC6 (after deploy): ...`. It doesn't hold the merge; it holds the issue's closing. Setup note says what data, device or environment a criterion would need to be run, or `none`. For an after-deploy criterion it names the window and the query.

## 3. Write the plan

Copy `templates/plan.md` from this skill's directory to `docs/specs/<domain>/<behaviour>.plan.md`. Frontmatter `issue` and `budget_usd`. Each plan has its own issue: task keys are `gh-<issue>/tN` and the merge job flips an issue once, so when one issue spans several specs, file a child issue per spec and name the parent in the spec's `issues`. `check-spec` refuses two plans on one issue. Sections:

- Approach: what you chose and why, and the options it beat. Usually the Sage's recommendation.
- Data model and contracts: types, endpoints, schema, events. Only what changes.
- Invariants: every invariant id in the domain's Persona, each `holds` (a short note after it may say why) or `exception: <reason>`. Don't skip an id because it seems irrelevant; mark it `holds`. Only the Self approves an exception.
- Tasks: a checklist. Each task is one Creator vessel, named by an id (`t1`, `t2`), may carry `after: <task-id>` naming other tasks in this plan (a wait on another spec's work goes in the task's text instead), and lists the criteria it makes true. One task is the default. Split only when a part can merge and ship on its own and is worth reviewing alone, when one part waits on a decision the rest doesn't, or when one task would outgrow a vessel's budget. Each split pays a fresh vessel's setup and review, so a small part (one query, one panel) stays in its neighbour's task. With more than one task, the Approach says which reason each split meets. Never one task per surface.

## 4. Mark what you can't decide

Where the answer belongs to the Self, or the facts don't settle it, write `[NEEDS CLARIFICATION: <question>]` in place. Don't guess and don't hedge in prose. Each marker blocks merge until the Self's answer replaces it. A question that turns out not to matter becomes a Non-goal.

Put the marker where the answer's words belong and keep it to a short slot label, four words or fewer, so the sentence still reads. Ask the full question in a note on the line below, indented under the list item:

```markdown
- AC2: A cold first page returns in at most [NEEDS CLARIFICATION: p95 ms] at p95.
  > **Open:** what p95 target, in ms, for a cold first page?
```

A question that decides whether a sentence stands gets a slot at the end of it (`[NEEDS CLARIFICATION: acceptable?]`). Two markers on one line get two notes, in the same order. On the spec PR, `unconscious questions` posts each marker as a review comment on its line. The Self replies in that thread in plain words, and the next run writes the answer in place of the marker and commits it to the branch.

## 5. Check before handing over

- Every criterion has an id and a settleable claim.
- No how in the spec: no file names, functions, libraries.
- Every Persona invariant id appears in the plan's Invariants section.
- Every criterion is covered by at least one task, except `(after deploy)` ones, which no task makes true; the after-deploy job runs them.
- `unconscious check-spec` passes, apart from the open markers.
- List the open markers and exceptions for the Self.

A domain with no Persona yet gets one first: follow the persona skill (`skills/persona/`). A draft Persona is enough to write a plan against; `check-spec` warns until the Self confirms it, and the Shadow checks its invariants either way. If the Persona has Proposed invariants, ask the Self whether to promote any before you list the plan's invariants.

The spec and plan land in one PR on `spec/<issue>`. When you write in the Self's answer to the last marker, set `status: approved` in the same edit; the Self never edits the file to approve it. Merging the PR is the approval: the merge job flips the issue and creates the tasks. `check-spec` fails while any marker is open, so a spec can't merge with an open question. To merge a spec as reference without starting work, the Self asks for `draft` and you keep it. Task PRs say `Refs #<issue>`, never `Closes`. When the last task merges, the task merge job sets the spec's `status` to `built` and closes the issue, or moves it to `verifying` until the after-deploy criteria pass. The Self sees every spec by status in the vault's `🌀 Now/Specs.base`.

## After exploring

Sometimes the Self works out what to build by building it, in a chat session, on a branch. Then the spec comes last, from what was built, so the decisions made while exploring aren't lost.

1. Work on the exploration branch, not a new `spec/` one.
2. If no issue covers the work, create one with `gh issue create`: what the change does and why, in two or three sentences, no state label.
3. Find or create the living spec, as in step 2 above. Write its criteria from the diff: what the branch now does, each one a claim a reader of the diff or one run could settle. Write only what the code does. If the Self wants something it doesn't do yet, that's a new issue, not a criterion.
4. Send a Shadow with those criteria and the branch's diff against its base. For each `unmet` one, the Self either fixes the code or you drop the criterion. Never keep a criterion the Shadow found unmet.
5. Put rules the exploration turned up (a limit, an order, something that broke when it was violated) under Proposed invariants in the Persona, with the `path:line` that relies on each.
6. No plan: the work is done. Set the spec's `status: built`. The PR carries code and spec together, and its body says `Closes #<issue>`, since nothing is left to split into tasks.

Reply with the criteria and their Shadow verdicts, the proposed invariants, and the issue.

## Naming criteria and tasks

Ids like `AC13` and `t5` mean nothing to a reader without the spec open. The first time you name one in anything a person reads (a reply, a vault page, a PR body, an issue comment), say what it is in a few words. Where Markdown renders, also link the id to its line in the spec on GitHub: `[AC13](https://github.com/<owner>/<repo>/blob/main/docs/specs/<domain>/<name>.md#L43) (a staff adoption report seven days after the gate opens)`. In a terminal reply the gloss alone is enough.
