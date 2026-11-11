---
status: proposed
decided: 2026-11-10
revised: 2026-11-11
scope: cross-project (Silk, impression, bakery)
supersedes: "[[Agent team design]]", "[[Agent team compositions]]", "[[Agent team compositions (archetypes)]]"
---

# Unconscious Development

Work that happens below your attention, surfaced to you only at approval points. Settled by interview on 2026-11-10 (44 questions, cited as Q numbers), reframed around a cast of Jungian archetypes on 2026-11-11. Nothing below is built. Read it, annotate what is wrong (`<leader>ya`), and the build order at the end starts after that.

Written for you, not for agents. Agents get smaller documents derived from this one: role prompts, skills, charters, PROJECT.md files.


## The shape

An agent is three layers (Q1). Any one alone collapses the other two.

1. a skill: the method, portable, in dotfiles
2. a role: a subagent definition that loads the skill, in dotfiles
3. a place it runs: a Bakery card, an agent session in any terminal, or a scheduled headless run

None of the three is tied to one harness. Skills follow the Agent Skills spec, roles are subagent definitions in whatever form the harness reads, the run place is a session or a card. Pi is the harness today; the design must survive swapping it. herdr is one way to open and watch sessions, not a requirement.

Work starts only from an approved spec. A spec is a file in `docs/specs/`, merged by PR. The merge flips a GitHub label, and a script generates the Bakery cards from it. You are the single approver. Nothing dispatches itself (Q5).


## The cast

Jung named the Self, Shadow, Persona, Trickster, and a few others. The Explorer, Sage, Ruler, Creator, and Magician come from Pearson and Mark's later twelve-archetype wheel. Both are used, labelled.

| Archetype | Source | On the wire | May | Must not |
|---|---|---|---|---|
| Self | Jung | you | approve specs, batches, merges | be delegated |
| Magician | Pearson | `chief` | read every `PROJECT.md` and `Now/` page, propose a batch, turn approved specs into cards | write specs or code, start cards |
| Ruler | Pearson | `lead` | hold one domain's charter, dispatch, write specs, make small changes (Q34) | push, open PRs, hand-write Ready cards |
| Explorer | Pearson | `researcher` | read anything, return paths and lines, answer questions | write |
| Sage | Pearson | `planner` | propose steps and order, with a reason | choose and then pretend to compare |
| Creator | Pearson | `worker` | change files, run tests, report | review its own work |
| Shadow | Jung | `reviewer` | see what the Creator did not want seen; return per-criterion verdicts with evidence | see the Creator's reasoning. Fresh context only |
| Trickster | Jung | verifier (new) | run the criteria the Shadow marked `needs-run` and try to make them fail | judge code it has not run |
| Persona | Jung | a charter or skill | the mask any archetype wears to become a specialist | be a role |

Archetypes are generic; a charter makes them specialists (Q2, Q15). A `mobile-creator` is a Creator wearing the mobile charter. Flexibility comes from the Persona, not from more roles (Q6, Q24): a thin charter behaves like a Sage, a rich one like a specialist.

`oracle`, a third read-only role that returned an answer instead of paths, is removed. The Explorer's task sets its output shape.

Whether the archetype names replace the wire names in role prompts is undecided (decision 5). Until then: archetypes on paper, wire names in the harness config.

### Boundaries

A boundary earns its place only when one of these differs across it. Domain, repo, and task size never qualify; the Persona carries those.

| Criterion | Splits |
|---|---|
| Write permission | Creator from Explorer, Sage, Shadow |
| Output contract | Shadow (verdicts) from Explorer (paths) from Trickster (pass or fail) |
| Context isolation | Shadow from Creator. Sage from Explorer, when sequenced |
| Authorization | Self from everyone. Ruler and Magician stop at proposing |
| Model tier | Ruler and Magician on the strongest model; Creator and Explorer on `auto` (Q29) |

Explorer and Sage differ only on output contract when dispatched alone. They earn separate existence when sequenced: the Sage plans on the Explorer's facts rather than on facts it chose to look for. Ruler and Sage both propose; the Sage proposes a plan for one task, the Ruler proposes within a domain's law with the Self in the room. Shadow and Trickster are the only two roles whose isolation is enforced by something other than a prompt: a fresh delegate context, a separate card.

### Two global rules

No tool is a dependency except files and scripts. The contract is Markdown (charters, `PROJECT.md`, specs, `Now/` pages, `AGENTS.md`), skills, and scripts (`check-spec`, `spec-to-cards`, the label workflow). Everything runs from a plain agent session or a Bakery card. herdr may add a tab or shortcut on top; Pi is the harness today; neither may be named in a charter, spec, or skill. Role prompts are the one place a harness's delegation tool appears, and the file to rewrite if the harness changes.

The cast owns the subagent namespace. Any harness or extension that ships its own subagent presets competes for the same names and delegation surface. Those presets get disabled or overridden so only the cast is reachable.


## A feature ticket, walked

Ticket: silk-remix #412, "Bulk archive from the orders list", labelled `domain:orders`, `needs-spec`.

```
 Magician ──proposes──▶ Self ──yes──▶ Ruler session (spec/412)
 (headless, morning)                   │  Explorer ──facts──▶ Sage ──shape──▶ Ruler + Self write spec
                                       ▼
                              PR, check-spec, merge, label flips
                                       │
 Magician ──spec-to-cards──▶ Creator card ──▶ Shadow (fresh) ──▶ Review
                                       │
                              Trickster card (needs-run criteria only) ──▶ Self approves, merge
```

1. Noticing. Magician. A headless morning run reads `PROJECT.md`, open issues, CI state, and yesterday's `Now/silk.md`. It appends a proposal to the page: #412 is small, the orders charter exists, spec it today.
2. Approval. Self. You read the page and say yes. First authorization point.
3. Spec. Self and Ruler, together. Interactive session on `spec/412`. The Ruler wears `docs/domains/orders/CHARTER.md`. It sends an Explorer for the facts (where the list query lives, how single archive works, whether a soft-delete flag exists). It sends a Sage for the shape (client loop, one mutation, or background job; recommends one, with a reason). You argue with the Ruler, pick the mutation, and the Ruler writes `docs/specs/412-bulk-archive.md` with acceptance criteria and a setup note. PR opened, `check-spec` passes, you merge, label flips to `ready-for-agent`.
4. Cards. Magician. `spec-to-cards` turns the spec into cards. One task, one Creator card; the body names the charter path and the criteria.
5. Making. Creator with Shadow. Bakery starts a session in a fresh worktree. The Creator reads the charter, implements, runs tests. Before reporting it summons a Shadow with the criteria copied from the card body. The Shadow returns `criteria: [{id, verdict, evidence}]`: the 500-id limit `met`, the audit-log entry `met`, "list shows 20 after archiving 30" `needs-run`. The Creator reports with the array attached. Card moves to Review.
6. Verifying. Trickster. Because one criterion is `needs-run`, a dependent card gets that criterion and the setup note: seed 50 orders, archive 30, assert the list shows 20. Pass or fail, nothing else. Had every criterion been `met`, this step would not exist.
7. Approval. Self. One diff, a verdict array, a verify result. Approve, merge. Second and last authorization point.

What the walk shows: the Ruler appears once, at spec time, where you are present, and never inside a one-task card. Explorer and Sage appear only in the spec session. The Magician proposes twice (what to do, how to split it) and you approve twice.


## Verification scope

The spec says what must be true. Who checks each claim is a property of the claim, decided when the diff exists, not a mode the spec picks. The Shadow's verdict has three states (Q13, Q37, revised):

```
criteria: [{ id, verdict: met | unmet | needs-run, evidence }]
```

`met` and `unmet` need evidence from the diff. `needs-run` means the claim cannot be known by reading, and the evidence field says what would have to run. Any `needs-run` produces a Trickster card with exactly those criteria and the spec's setup note. None means the Shadow's verdict is the whole verification. A package bump comes out as all `met` with no Trickster, without anyone labelling it trivial.

Tests and lint are not verification. The Creator runs them before it reports; CI runs them before merge. Neither reviews the change.

Advice to spec authors, not a rule: write a criterion as a statement about the code ("the mutation rejects more than 500 ids") when reading can settle it, and as given/when/then ("given 50 orders, when 30 are archived, the list shows 20") when only running can. The second shape is what the Trickster will get.

Control: a lazy Shadow marks everything `needs-run`. The evidence requirement and your eye on the ratio over the first cards are the check.


## Compositions inside a card

Bakery constraints: one card is one agent session in one worktree; a finished run reaches Review only; retry continues the same session; `depend` cuts the next worktree from a `main` holding the earlier card; card runs see only the repo's `AGENTS.md` and the global one, so the Persona must be named in the card body.

| | A Creator + Shadow | B Ruler's court | C journey of cards | D Magician + Self |
|---|---|---|---|---|
| Shape | Creator summons Shadow before reporting | Ruler in the card dispatches Explorer, Creator, Shadow | Explorer card → Creator card → Trickster card | Magician outside; A inside each card |
| Sessions per task | 1 | 1 | 3 | 1 |
| Strong-model layers | 1 | 2 | 1 | 1 (+Magician) |
| Trickster | only via `needs-run` | only via `needs-run` | always a card | via `needs-run` |
| Review stops | 1 | 1 | 3 | 1 |
| Persona loaded by | card body | Ruler | each card body | card body |
| Needs an interactive session | no | no | no | for approval only |
| Build-order step | 2 | 1 and 2 | 3 | 4 |

A is the default and needs nothing new. The Shadow's task must read criteria from the card body, never from the Creator's message; a Shadow briefed by the Creator is a mirror. B is for a domain whose specs keep coming back thin; its risk is a Ruler whose context fills with the Creator's transcript and starts judging, so the Shadow stays a separate delegate. C is Bakery-only and gives each stage its own diff and cost line; its cost is three Review stops unless unattended review passes the read-only cards. D is the end state and composes with A or B inside the card. The walked ticket is D with A inside.


## Decisions

### Structure

**Q2, Q15. Charter sections.** `docs/domains/<name>/CHARTER.md`: owner, scope (agent-map areas), invariants (what this domain refuses), standing questions, cost model, key files, recent decisions (ADR links), how to run things here (which db-tests, which device, which dashboard; the Trickster's setup source).

**Q34. A Ruler may implement small changes itself.** At most 3 files, no schema or migration, no `.tsx` or mobile UI, no new dependency, no paid-API path. It still writes a short spec and still gets a Shadow. Skip the dispatch, not the record.

**Q14. Two new roles only.** Ruler and Magician. Specifying and briefing are skills those roles load.

**Q25, Q36. The Magician is cross-domain and cross-project.** It reads `PROJECT.md` in each repo (tracker, hosted Bakery server and board, CI, vault page), proposes a batch (issues, domain, order, rough spend), appends it to the vault page, and after approval runs `spec-to-cards`.

**Q8. Dotfiles hold the generic parts; repos hold the specific parts.** Cast and skills: `~/.agents/skills` plus the harness's role config, both chezmoi-managed. Charters, `PROJECT.md`, specs: in each repo.

### Tracker and spec

**Q9, Q19. Drop Linear. GitHub Issues everywhere.** Migrate only Linear Todo and In Progress, about 50 issues: title, body, `domain:*` labels, an `imported-from: SIL-nnn` line, one-shot script kept in the repo. Repo tooling that changes: `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md`, the PR-body Linear link rule, `linear-nuke`, Bakery card keys.

**Q20. Labels carry domain and state.** One `domain:<name>` per issue. State: `needs-spec`, `ready-for-agent`, `ready-for-human`.

**Q3, Q10. The spec is a file.** `docs/specs/<issue>-<slug>.md`. The issue links to it. The card body is generated from it.

**Q11. Required spec sections (revised).** Goal; Non-goals; Acceptance criteria (each with an id); Setup note (data, device, environment a `needs-run` criterion would need; may say `none`); Surfaces touched; Constraints and invariants (from the charter; may say `none`); Cost and scale (may say `none`). The former Verification section is gone; scope is decided per criterion by the Shadow.

**Q31. Spec format.** Frontmatter `issue`, `domain`, `status`, `budget_usd`, `surfaces`; fixed headings; tasks as a checklist, an item may carry `after: <task-id>`. `check-spec` validates `docs/specs/**` in CI and refuses a spec without acceptance criteria.

**Q12, Q21. You and the Ruler draft together.** Interactive agent session, `spec/<issue>` branch, same worktree, you edit the file directly. Lands by PR, Codiff for the walkthrough. Merging is the approval.

**Q32. Merge flips the label.** A GitHub Action on merge to `main` that touches a spec with `status: approved` moves `needs-spec` to `ready-for-agent` and comments the spec path on the issue. `spec-to-cards` refuses anything else.

**Q22, Q23. One card per task.** `spec-to-cards <issue>` creates cards with `--key gh-<issue>/<task>` and `depend` edges. Never one card per surface.

**Q33. Out-of-scope findings become issues.** `gh issue create` with `needs-spec` and the domain label, linked from the PR body.

### Memory and switching

**Q4, Q17, Q35. One vault page per project.** `Now/<project>.md` plus `Now/index.md`. Frontmatter `last_briefed`, `briefing_sources`. Sections: Priority now; In flight; Blocked on me; Decisions pending; Proposed batch (the Magician appends here); Last touched.

**Q7, Q27. Briefing is a skill, run on demand.** Inputs: `gh` (open PRs, CI state, issues by label), Bakery cards, runs, cost, and the page's previous state so it can say what changed. Grafana and Sentry join after two weeks of the cheap sources being right. Must work in print mode and never rely on a terminal UI to show its result.

**Q26, Q42. The Magician is a resumed agent session.** Its contract is its inputs and the `Now/` page it writes. Where it runs is a choice per day: a resumed session in a terminal, a herdr tab, a headless cron on mochi, later a Bakery room. A Ruler you collaborate with is the same kind of session. Rulers inside a card run are ephemeral delegates.

**Q41. Hosted Bakery on mochi is canonical.** `http://mochi:4317`, every project. Local boards are scratch and the Magician ignores them.

### Tooling home

**Q43.** `check-spec`, the spec, charter, and `PROJECT.md` templates, and the label-flip workflow: a new package in `~/code/clearstack`. `spec-to-cards`: in Bakery as `bakery-cli spec-to-cards`.

**Q40. Names.** Files: `docs/domains/<name>/CHARTER.md`, `PROJECT.md`. Roles: see decision 5.


## What gets built

Dotfiles: Ruler and Magician roles; `spec` skill (Q11 shape); `briefing` skill (Q27 inputs); the Shadow's verdict contract in its role prompt.

clearstack, new package: `check-spec`; spec, charter, `PROJECT.md` templates; label-flip workflow.

Bakery: `bakery-cli spec-to-cards`; store the `criteria` array on the card; emit a Trickster card when any verdict is `needs-run`.

silk-remix: six charters under `docs/domains/` (ingestion-search, mobile, web, api-contracts-shared, infra-ci-release, billing-insights-console), drafted by an Explorer from `docs/agent-map/`, `CODEBASE_OVERVIEW.md`, ADRs, `notes/03 Landscape/`; you edit invariants and standing questions (Q28). `PROJECT.md`. Linear migration script.

impression, bakery: `PROJECT.md`, `docs/specs/`, a mochi board for impression.

Vault: `Now/index.md`, `Now/silk.md`, `Now/impression.md`, `Now/bakery.md`.


## Build order (Q30)

1. Ruler role, `spec` skill, ingestion-search charter.
2. SIL-258 (SSE connections cut at about 125 s) through the loop by hand, composition A: spec PR, one card by hand, Creator, Shadow with criteria. Measure reconnects per hour before and after, and how often the Shadow's `unmet` and `needs-run` are right.
3. `check-spec`, label-flip workflow, `spec-to-cards`. Redo step 2's card creation through the script.
4. Magician role, `briefing` skill, Silk `PROJECT.md`, its vault page. Use the Magician for one week.
5. Migrate Linear, add labels, retire `linear-nuke`.
6. The other five Silk charters.
7. `PROJECT.md`, `docs/specs/`, mochi board for impression and bakery (Q38).
8. Bakery stores criteria; Trickster card on first `needs-run`; later, block Done on `unmet`.


## Decide

1. Which composition for step 2. Proposed: A.
2. Whether a spec author may pre-mark a criterion `needs-run` for known device or data needs, or only the Shadow may.
3. Whether the Trickster is a role or only a card.
4. Whether Ruler is a role or a Persona a Creator wears, pending the check on whether the harness's role config accepts new names and on disabling competing presets.
5. Whether archetype names replace the wire names in role prompts. Agents following `clear-voice` will push back on metaphor in prompts; wire names may be better on the wire and archetypes on paper.


## Open, not decided

- Where the current harness defines subagent roles, and whether third
party presets there are disabled. A lookup.
- How a card run loads the Ruler when a card needs domain context.
Probably the card body names the charter path.
- Whether silk-remix's `ops-alert` issues get a `domain:*` label or stay
outside the taxonomy.
