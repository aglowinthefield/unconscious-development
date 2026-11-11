---
status: superseded
superseded-by: "[[Unconscious Development]]"
decided: 2026-11-10
scope: cross-project (Silk, impression, bakery)
---

# Unconscious Development: agent team design

The flow is called Unconscious Development: work that happens below your
attention, surfaced to you only at approval points.

Settled by interview on 2026-11-10, 44 questions. Nothing below is built.
Read it, annotate what is wrong (`<leader>ya`), and the build order at the
end starts after that.

Written for you, not for agents. Agents get smaller documents derived from
this one: role prompts, skills, charters, PROJECT.md files.


## The shape

An agent is three layers:

1. a skill: the method, portable, lives in dotfiles
2. a role: a subagent definition that loads the skill, also in dotfiles
3. a place it runs: a Bakery card, an agent session in any terminal, or
   a scheduled headless run. herdr is one way to open and watch these
   sessions, not a requirement of the flow.

None of the three is tied to one harness. Skills follow the Agent Skills
spec, roles are subagent definitions in whatever form the harness reads,
and the run place is a session or a card. Pi is the harness in use
today; the design must survive swapping it.

Two roles are new.

- `lead` owns one domain. It reads that domain's CHARTER.md and dispatches
  the existing archetypes (researcher, planner, worker, reviewer).
- `chief` is cross-project. It reads every repo's PROJECT.md and vault page,
  proposes the next batch of work, and after you approve, turns specs into
  Bakery cards.

Work starts only from an approved spec. A spec is a file in `docs/specs/`,
merged by PR. The merge flips a GitHub label, and a script generates the
Bakery cards from it.

You stay the single approver. Nothing dispatches itself.


## Decisions

Each item is the decision, then the reason. Q numbers point back to the
interview.


### Structure

**Q1. An agent is skill + role + run location.**
Any one of those alone collapses the other two.

**Q2, Q15. Archetypes are generic; a charter makes them specialists.**
The lead reads `docs/domains/<name>/CHARTER.md`. Sections:

- owner
- scope (which agent-map areas)
- invariants (what this domain refuses)
- standing questions
- cost model
- key files
- recent decisions (ADR links)
- how to verify a change here (which db-tests, which device, which
  dashboard)

The verify section is what separates "implemented" from "verified".

**Q6, Q24. One `lead` role, not six.**
It may: read everything, dispatch researcher, planner, worker, and reviewer,
write specs, run `spec-to-cards` on a merged spec in its own domain, and
open follow-up issues with `gh issue create`.

It may not: push, open PRs, or hand-write Ready cards.

Flexibility comes from the charter, not from more roles. A thin charter
behaves like a planner; a rich one behaves like a specialist.

**Q34. A lead may implement small changes itself.**
Small means: at most 3 files, no schema or migration, no `.tsx` or mobile
UI, no new dependency, no paid-API path. It still writes a short spec and
still gets a reviewer. Skip the dispatch, not the record.

**Q14. Two new roles only: `lead` and `chief`.**
Specifying and briefing are skills those roles load, not roles of their
own.

**Q25, Q36. The chief is cross-domain and cross-project.**
It reads `PROJECT.md` in each repo (tracker, hosted Bakery server and
board, CI, vault page). It proposes a batch: which issues, which domain,
what order, rough spend. It appends the proposal to the vault page. After
you approve, it runs `spec-to-cards`.

It never writes specs or code and never starts cards.

**Q5. You dispatch.**
The chief proposes, you approve the batch. More autonomy than that breaks
Silk's rule that subagents do not inherit authorization.

**Q8. Dotfiles hold the generic parts; repos hold the specific parts.**
Archetypes and skills: `~/.agents/skills` plus the harness's role config,
both chezmoi-managed. Charters, PROJECT.md, and specs: in each repo, so a second
engineer inherits them.


### Tracker and spec

**Q9, Q19. Drop Linear. GitHub Issues everywhere.**
Migrate only Linear Todo and In Progress, about 50 issues: title, body,
`domain:*` labels, an `imported-from: SIL-nnn` line, via a one-shot script
kept in the repo.

Repo tooling that changes: `docs/agents/issue-tracker.md`,
`docs/agents/triage-labels.md`, the PR-body Linear link rule,
`linear-nuke`, Bakery card keys.

**Q20. Labels carry domain and state.**
One `domain:<name>` per issue. State labels: `needs-spec`,
`ready-for-agent`, `ready-for-human`. An issue without an approved spec is
not startable.

**Q3, Q10. The spec is a file.**
`docs/specs/<issue>-<slug>.md`. The issue links to it. The Bakery card body
is generated from it.

**Q11. Required spec sections.**

- Goal
- Non-goals
- Acceptance criteria (Given / When / Then)
- Verification (which check or evidence proves each criterion)
- Surfaces touched
- Constraints and invariants (from the charter; may say `none`)
- Cost and scale (may say `none`)

**Q31. Spec format is frontmatter plus fixed headings.**
Frontmatter: `issue`, `domain`, `status`, `budget_usd`, `surfaces`. Tasks
are a checklist; an item may carry `after: <task-id>`. A `check-spec`
script validates `docs/specs/**` in CI.

**Q12, Q21. You and the lead draft together.**
Interactive agent session (a herdr tab is the usual way to open one),
`spec/<issue>` branch, same worktree, you edit the
file directly. The spec lands by PR, Codiff for the walkthrough. Merging
the spec PR is the approval.

**Q32. Merge flips the label.**
A GitHub Action on merge to `main` that touches a spec with
`status: approved` moves `needs-spec` to `ready-for-agent` and comments
the spec path on the issue. `spec-to-cards` refuses an issue that is not
`ready-for-agent`.

**Q22, Q23. One card per task in the spec.**
`spec-to-cards <issue>` creates cards with `--key gh-<issue>/<task>` and
`depend` edges. Small specs have one task. Fewer PRs within reason. Never
one card per surface.

**Q29. Model routing.**
Chief and lead on the strongest model. Worker and researcher on `auto`.
Reviewer per Silk's routing rule. Card budget comes from the spec's
`budget_usd`.

**Q13, Q37. The reviewer reports per criterion.**
It reads criteria from the card body and returns
`criteria: [{id, status: met|unmet|unverifiable, evidence}]` beside
`verdict`. Bakery stores it on the card. Blocking Review to Done on
`unmet` comes later.

**Q33. Out-of-scope findings become issues.**
`gh issue create` with `needs-spec` and the domain label, linked from the
PR body. GitHub Issues is the only inbox.


### Memory and switching

**Q4, Q17, Q35. One vault page per project.**
`~/Documents/Obsidian Vault/Now/<project>.md`, plus `Now/index.md` ranking
projects. Frontmatter: `last_briefed`, `briefing_sources`. Sections:

- Priority now
- In flight
- Blocked on me
- Decisions pending
- Proposed batch (the chief appends here)
- Last touched

**Q7, Q27. Briefing is a skill, run on demand.**
Inputs: `gh` (open PRs, CI state, issues by label), Bakery cards, runs,
and cost, and the page's previous state so it can say what changed.
Grafana and Sentry join after two weeks of the cheap sources being right.

**Q26, Q42. The chief is a resumed agent session, not a herdr feature.**
Its contract is its inputs (Q27) and the `Now/` page it writes. Where it
runs is a choice per day: a resumed session in a terminal, a herdr tab,
a headless cron on mochi that appends a proposal to the page, or later a
Bakery room. The briefing skill must therefore work in print mode and
never depend on a terminal UI to show its result. Local first; mochi
once its tool set is stable. A lead you collaborate with is the same
kind of session. Leads inside a card run are ephemeral delegates.

**Global rule: no tool is a dependency except files and scripts.**
The contract of Unconscious Development is Markdown (charters,
PROJECT.md, specs, `Now/` pages, AGENTS.md), skills, and scripts
(`check-spec`, `spec-to-cards`, the label workflow). Everything must run
from a plain agent session or a Bakery card. herdr may add a tab, a
sidebar, or a shortcut on top; Pi is the harness today; neither may be
named in a charter, spec, or skill. Role prompts are the one place a
harness's delegation tool appears, and they are the file to rewrite if
the harness changes.

**Global rule: the roles must own the subagent namespace.**
Any harness or extension that ships its own subagent presets will
compete with these roles for the same names and the same delegation
surface. Those presets get disabled or overridden in the harness config
so only Unconscious Development's roles are reachable.

**Q41. Hosted Bakery on mochi is canonical.**
`http://mochi:4317`, for every project. Local Bakery boards are scratch
and the chief ignores them. impression needs a board there.


### Tooling home

**Q43. Shared tooling has two homes.**
`check-spec`, the spec, charter, and PROJECT.md templates, and the
label-flip workflow: a new package in `~/code/clearstack`, not coupled to
the rest of it. `spec-to-cards`: in Bakery as `bakery-cli spec-to-cards`,
since Bakery owns cards.

**Q40. Names.**
Roles: `lead`, `chief`. Files: `docs/domains/<name>/CHARTER.md`,
`PROJECT.md`.


## What gets built

Dotfiles

- `lead` delegate role
- `chief` delegate role
- `spec` skill (drafting, Q11 shape)
- `briefing` skill (Q27 inputs)

clearstack, new package

- `check-spec`
- spec, charter, and PROJECT.md templates
- label-flip GitHub workflow

Bakery

- `bakery-cli spec-to-cards`
- reviewer `criteria` array stored on the card

silk-remix

- six charters under `docs/domains/`: ingestion-search, mobile, web,
  api-contracts-shared, infra-ci-release, billing-insights-console.
  A researcher drafts each from `docs/agent-map/`, `CODEBASE_OVERVIEW.md`,
  ADRs, and `notes/03 Landscape/`. You edit invariants and standing
  questions yourself (Q28).
- `PROJECT.md`
- Linear migration script under `scripts/`

impression, bakery

- `PROJECT.md`, `docs/specs/`, a mochi board for impression

Vault

- `Now/index.md`, `Now/silk.md`, `Now/impression.md`, `Now/bakery.md`


## Build order (Q30)

1. Write the `lead` role, the `spec` skill, and the ingestion-search
   charter.
2. Run SIL-258 (SSE connections cut at about 125 s) through the loop by
   hand: spec PR, one card made by hand, worker, reviewer with criteria.
   Measure reconnects per hour before and after.
3. Add `check-spec`, the label-flip workflow, and `spec-to-cards`. Redo
   step 2's card creation through the script.
4. Write the `chief` role, the `briefing` skill, Silk's `PROJECT.md`, and
   its vault page. Use the chief for one week.
5. Migrate Linear, add labels, retire `linear-nuke`.
6. The other five Silk charters.
7. `PROJECT.md`, `docs/specs/`, and a mochi board for impression and
   bakery (Q38).
8. Bakery stores reviewer criteria; later, block Done on `unmet`.


## Open, not decided

- Where the current harness defines subagent roles, and whether third
  party presets there are disabled. A lookup, not a decision.
- How a Bakery card run loads the lead role when a card needs domain
  context. Probably the card body names the charter path.
- Whether silk-remix's `ops-alert` issues get a `domain:*` label or stay
  outside the taxonomy.
