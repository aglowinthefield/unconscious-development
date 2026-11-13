---
name: spec
description: Write or edit the acceptance criteria for a change, as issue criteria (trivial tier) or as a living spec plus a plan (designed tier), gated on the domain Persona's invariants. Use when specifying an issue, writing or editing docs/specs/, or turning an idea into something a Creator can build.
---

# Spec

A spec says what a behaviour does and why. A plan says how one change gets there. Neither says anything a Creator would have to guess at.

## 1. Pick the tier

Trivial: typo, constant, copy, config flag, or a net addition with no design choice. One task, no schema change, no new dependency. Write the criteria in the issue body under `## Acceptance criteria` and stop. No spec file, no plan.

Everything else is designed: a spec in `docs/specs/<domain>/<behaviour>.md` and a plan beside it. If in doubt, it's designed.

## 2. Find or create the spec

Specs are living, one per behaviour (bulk archive, not "add a limit to bulk archive"). Search `docs/specs/<domain>/` first. If the behaviour has a spec, edit it: keep criterion ids, delete removed criteria outright, add new ids after the highest one. Otherwise copy `templates/spec.md` from this skill's directory.

Required sections, in order: Goal; Non-goals; Acceptance criteria; Setup note; Surfaces touched; Cost and scale. Frontmatter: `domain`, `status` (`draft` until the Self approves, then `approved`), `issues` (every issue that shaped it, append yours), `surfaces`.

Each criterion has an id (`AC1`, `AC2`, …) and one observable claim that a reader of the diff, or one run, could settle. Not "works well", "fast", "handles errors". Name the number, the state, the response. Setup note says what data, device or environment a criterion would need to be run, or `none`.

## 3. Write the plan

Copy `templates/plan.md` from this skill's directory to `docs/specs/<domain>/<behaviour>.plan.md`. Frontmatter `issue` and `budget_usd`. Sections:

- Approach: what you chose and why, and the options it beat. Usually the Sage's recommendation.
- Data model and contracts: types, endpoints, schema, events. Only what changes.
- Invariants: every invariant id in the domain's Persona, each `holds` or `exception: <reason>`. Don't skip an id because it seems irrelevant; mark it `holds`. Only the Self approves an exception.
- Tasks: a checklist. Each task is one Creator vessel, named by an id (`t1`, `t2`), may carry `after: <task-id>`, and lists the criteria it makes true. Never one task per surface.

## 4. Mark what you can't decide

Where the answer belongs to the Self, or the facts don't settle it, write `[NEEDS CLARIFICATION: <question>]` in place. Don't guess and don't hedge in prose. Each marker blocks merge until the Self's answer replaces it. A question that turns out not to matter becomes a Non-goal.

## 5. Check before handing over

- Every criterion has an id and a settleable claim.
- No how in the spec: no file names, functions, libraries.
- Every Persona invariant id appears in the plan's Invariants section.
- Every criterion is covered by at least one task.
- List the open markers and exceptions for the Self.

A domain with no Persona yet gets one first, from `templates/persona.md`. Its invariants are the Self's to write; draft them and mark each `[NEEDS CLARIFICATION]` until the Self confirms it.

The spec and plan land in one PR on `spec/<issue>`. Merging it is the approval; the merge job flips the issue and creates the tasks.
