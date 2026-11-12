---
status: proposed
decided: 2026-11-10
revised: 2026-11-12
scope: cross-project (Silk, impression, bakery)
supersedes:
  - "[[Agent team design]]"
  - "[[Agent team compositions]]"
  - "[[Agent team compositions (archetypes)]]"
---

%%Work that happens below your attention, surfaced to you only at approval points. I hate this line. Let's not add sales pitches in this doc.%%
%% @agent 2026-11-11: removed the line; the doc opens with the interview sentence %%
Settled by interview on 2026-11-10 ([[Interview 2026-11-10|transcript]]; footnotes point at the question), reframed around a cast of Jungian archetypes on 2026-11-11. Nothing below is built. Read it, annotate what is wrong (`<leader>ya`), and the build order at the end starts after that.

Written for you, not for agents. Agents get smaller documents derived from this one: role prompts, skills, Personas, PROJECT.md files.

## The shape

%%We have the interview archived somewhere right? Do we need these Qn markers everywhere? Could we put the transcript in a different doc and link to it via footnote links?%%
%% @agent 2026-11-11: transcript exported from the pi session to archive/Interview 2026-11-10.md; every Qn is now a footnote linking to that question's heading %%
An agent is three layers[^Q1]. Any one alone collapses the other two.

1. a skill: the method, portable, in dotfiles
2. a role: a subagent definition that loads the skill, in dotfiles
3. a place it runs: a vessel, an agent session in any terminal, or a scheduled headless run

None of the three is tied to one harness. Skills follow the Agent Skills spec, roles are subagent definitions in whatever form the harness reads, the run place is a session or a vessel. Pi is the harness today; the design must survive swapping it. `herdr` is one way to open and watch sessions, not a requirement.

%%We don't want strict reliance on GitHub for this flow. I'm also nervous about unbounded growth of the docs/specs folder. We've had thousands of pull requests the past few months and most of those specs are going to be useless almost immediately (e.g. typos, changing constant values, net additions). %%
%% @agent 2026-11-11: tracker is now an interface (issue, domain, state) with GitHub as today's implementation; specs are tiered, so trivial work carries its criteria in the issue and never gets a file; merged specs are pruned %%
Work starts only from approved acceptance criteria. Where they live depends on the work. A trivial change (typo, constant, copy, a net addition with no design) carries its criteria in the issue, and its task is made from the issue. Work that needs design gets a spec file in `docs/specs/`, merged by PR; the merge sets the issue's state, and a script generates the tasks from it. You are the single approver. Nothing dispatches itself[^Q5].

The tracker is an interface, not a tool: an issue has a domain, a state, and acceptance criteria, and the scripts read and write those through one thin adapter. GitHub Issues is today's implementation, the same way Pi is today's harness.

A vessel is where one task is worked, after the alchemists' sealed *vas* that Jung read as the container of the work: one agent session, in one fresh worktree, sealed from the others, its result taken out for review. The runner that provides vessels is an interface too, with four verbs: start a task in a fresh worktree, make one task depend on another, report a finished task for review, retry a task in the same session. A plain agent session started by hand is a runner; Bakery is today's. Vessel is the name on paper. Scripts, prompts and the runner adapter say task.


## The cast

Jung named the Self, Shadow, Persona, Trickster, and a few others. The Explorer, Sage, Ruler, Creator, and Magician come from Pearson and Mark's later twelve-archetype wheel. Both are used, labelled.

| Archetype | Source  | On the wire        | May                                                                                      | Must not                                        |
| --------- | ------- | ------------------ | ---------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Self      | Jung    | you                | approve specs, batches, merges                                                           | be delegated                                    |
| Magician  | Pearson | `chief`            | read every `PROJECT.md` and `🌀 Now/` page, propose a batch, turn approved specs into tasks | write specs or code, start vessels              |
| Ruler     | Pearson | `lead`             | hold one domain's Persona, dispatch, write specs, make small changes[^Q34]               | push, open PRs, hand-write ready tasks          |
| Explorer  | Pearson | `researcher`       | read anything, return paths and lines, answer questions                                  | write                                           |
| Sage      | Pearson | `planner`          | propose steps and order, with a reason                                                   | choose and then pretend to compare              |
| Creator   | Pearson | `worker`           | change files, run tests, report                                                          | review its own work                             |
| Shadow    | Jung    | `reviewer`         | see what the Creator did not want seen; return per-criterion verdicts with evidence      | see the Creator's reasoning. Fresh context only |
| Trickster | Jung    | verifier (new)     | run the criteria the Shadow marked `needs-run` and try to make them fail                 | judge code it has not run                       |
| Persona   | Jung    | `docs/personas/<domain>.md` | hold one domain's context: what it refuses, what it costs, where its files are, how to run it | be dispatched. A file, read first by whoever works in the domain                 |

%%We should be more clear about what a charter is, and maybe decide if there are alternative names that are more Jungian for it to match. Even I'm not totally clear where a charter lives or what it does.%%
%% @agent 2026-11-11: charter is gone; the Persona is the file, docs/personas/<domain>.md, and this paragraph now says what it holds, who reads it, who writes it %%
Archetypes are generic; a Persona makes them specialists[^Q2][^Q15]. The Persona is the one cast member that is a file rather than a role: `docs/personas/<domain>.md`, one per domain, in the repo it describes. Whoever works in that domain reads it first, so the mobile Ruler and the mobile Creator are the plain Ruler and Creator wearing `docs/personas/mobile.md`. Flexibility comes from the Persona, not from more roles[^Q6][^Q24]: a thin Persona behaves like a Sage, a rich one like a specialist.

A Persona holds: owner; scope (which agent-map areas); invariants (what this domain refuses); standing questions; cost model; key files; recent decisions (ADR links); how to run things here (which db-tests, which device, which dashboard; the Trickster's setup source). An Explorer drafts it from the repo's existing docs; you and a Ruler edit the invariants and standing questions; it changes by PR like any other file.

%%No need for this.%%
%% @agent 2026-11-11: removed the oracle paragraph %%

Whether the archetype names replace the wire names in role prompts is undecided (decision 5). Until then: archetypes on paper, wire names in the harness config.

### Boundaries

A boundary earns its place only when one of these differs across it. Domain, repo, and task size never qualify; the Persona carries those.

| Criterion         | Splits                                                                          |
| ----------------- | ------------------------------------------------------------------------------- |
| Write permission  | Creator from Explorer, Sage, Shadow                                             |
| Output contract   | Shadow (verdicts) from Explorer (paths) from Trickster (pass or fail)           |
| Context isolation | Shadow from Creator. Sage from Explorer, when sequenced                         |
| Authorization     | Self from everyone. Ruler and Magician stop at proposing                        |
| Model tier        | Ruler and Magician on the strongest model; Creator and Explorer on `auto`[^Q29] |

Explorer and Sage differ only on output contract when dispatched alone. They earn separate existence when sequenced: the Sage plans on the Explorer's facts rather than on facts it chose to look for. Ruler and Sage both propose; the Sage proposes a plan for one task, the Ruler proposes within a domain's law with the Self in the room. Shadow and Trickster are the only two roles whose isolation is enforced by something other than a prompt: a fresh delegate context, a separate vessel.

### Two global rules

No tool is a dependency except files and scripts. The contract is Markdown (Personas, `PROJECT.md`, specs, `🌀 Now/` pages, `AGENTS.md`), skills, and scripts (`check-spec`, `spec-to-tasks`, the label workflow). Everything runs from a plain agent session or a vessel on any runner. herdr may add a tab or shortcut on top; Pi is the harness today; neither may be named in a charter, spec, or skill. Role prompts are the one place a harness's delegation tool appears, and the file to rewrite if the harness changes.

The cast owns the subagent namespace. Any harness or extension that ships its own subagent presets competes for the same names and delegation surface. Those presets get disabled or overridden so only the cast is reachable.


### Triggers

Nothing in the cast runs on its own. The Magician's method is the `briefing` skill, and a trigger is whatever invokes it. Today that is you, typing `/briefing silk` in a session; the skill reads the tracker, the runner's tasks and the previous `🌀 Now/silk.md`, rewrites the page, and names at its top who asked and when. That is the whole mechanism, and it is enough to test the Magician before any role exists.

The other kinds are the same skill invoked by something other than you:

| Kind | Invoked by | The Magician asks |
|---|---|---|
| request | you, `/briefing <project>` | whatever you asked |
| scheduled | a cron running `pi -p "/briefing silk"` | what should run next |
| event | a hook on a vessel reaching review or a spec merging | does this unblock anything |

Only the first exists until its proposals have been right for a while. The page's `trigger` line is what tells a later reader why a proposal was made.

## A feature ticket, walked

Ticket: silk-remix #412, "Bulk archive from the orders list", labelled `domain:orders`, `needs-spec`.

```
 Magician ──proposes──▶ Self ──yes──▶ Ruler session (spec/412)
 (/briefing silk)                      │  Explorer ──facts──▶ Sage ──shape──▶ Ruler + Self write spec
                                       ▼
                              PR, check-spec, merge, label flips
                                       │
 Magician ──spec-to-tasks──▶ Creator vessel ──▶ Shadow (fresh) ──▶ Review
                                       │
                              Trickster vessel (needs-run criteria only) ──▶ Self approves, merge
```

%%Not sure what headless, morning really is. There should be a general trigger for these. Needs to be more abstract but also defined. %%
%% @agent 2026-11-11: replaced with "on a trigger" and added a Triggers paragraph after the two global rules; three kinds, no infrastructure %%
1. Noticing. Magician. On a trigger (here, you ran `/briefing silk`) the Magician reads `PROJECT.md`, open issues, CI state, and yesterday's `🌀 Now/silk.md`. It appends a proposal to the page: #412 is small, the orders Persona exists, spec it today.
2. Approval. Self. You read the page and say yes. First authorization point.
3. Spec. Self and Ruler, together. Interactive session on `spec/412`. The Ruler wears `docs/personas/orders.md`. It sends an Explorer for the facts (where the list query lives, how single archive works, whether a soft-delete flag exists). It sends a Sage for the shape (client loop, one mutation, or background job; recommends one, with a reason). You argue with the Ruler, pick the mutation, and the Ruler writes `docs/specs/412-bulk-archive.md` with acceptance criteria and a setup note. PR opened, `check-spec` passes, you merge, label flips to `ready-for-agent`.
4. Tasks. Magician. `spec-to-tasks` turns the spec into tasks. One task, one Creator vessel; the task body names the Persona path and the criteria.
5. Making. Creator with Shadow. The runner starts a session in a fresh worktree. The Creator reads the Persona, implements, runs tests. Before reporting it summons a Shadow with the criteria copied from the task body. The Shadow returns `criteria: [{id, verdict, evidence}]`: the 500-id limit `met`, the audit-log entry `met`, "list shows 20 after archiving 30" `needs-run`. The Creator reports with the array attached. The vessel reaches Review.
6. Verifying. Trickster. Because one criterion is `needs-run`, a dependent vessel gets that criterion and the setup note: seed 50 orders, archive 30, assert the list shows 20. Pass or fail, nothing else. Had every criterion been `met`, this step would not exist.
7. Approval. Self. One diff, a verdict array, a verify result. Approve, merge. Second and last authorization point.

What the walk shows: the Ruler appears once, at spec time, where you are present, and never inside a one-task vessel. Explorer and Sage appear only in the spec session. The Magician proposes twice (what to do, how to split it) and you approve twice.


## Verification scope

The spec says what must be true. Who checks each claim is a property of the claim, decided when the diff exists, not a mode the spec picks. The Shadow's verdict has three states[^Q13][^Q37] (revised):

```
criteria: [{ id, verdict: met | unmet | needs-run, evidence }]
```

`met` and `unmet` need evidence from the diff. `needs-run` means the claim cannot be known by reading, and the evidence field says what would have to run. Any `needs-run` produces a Trickster vessel with exactly those criteria and the spec's setup note. None means the Shadow's verdict is the whole verification. A package bump comes out as all `met` with no Trickster, without anyone labelling it trivial.

Tests and lint are not verification. The Creator runs them before it reports; CI runs them before merge. Neither reviews the change.

Advice to spec authors, not a rule: write a criterion as a statement about the code ("the mutation rejects more than 500 ids") when reading can settle it, and as given/when/then ("given 50 orders, when 30 are archived, the list shows 20") when only running can. The second shape is what the Trickster will get.

Control: a lazy Shadow marks everything `needs-run`. The evidence requirement and your eye on the ratio over the first vessels are the check.


## Compositions inside a vessel

What any runner must guarantee: one vessel is one agent session in one worktree; a finished run reaches Review only; retry continues the same session; a dependency cuts the next worktree from a `main` holding the earlier task; a vessel sees only the repo's `AGENTS.md` and the global one, so the Persona must be named in the task body.

|                              | A Creator + Shadow                      | B Ruler's court                                        | C journey of vessels                          | D Magician + Self                    |
| ---------------------------- | --------------------------------------- | ------------------------------------------------------ | --------------------------------------------- | ------------------------------------ |
| Shape                        | Creator summons Shadow before reporting | Ruler in the vessel dispatches Explorer, Creator, Shadow | Explorer vessel → Creator vessel → Trickster vessel | Magician outside; A inside each vessel |
| Sessions per task            | 1                                       | 1                                                      | 3                                             | 1                                    |
| Strong-model layers          | 1                                       | 2                                                      | 1                                             | 1 (+Magician)                        |
| Trickster                    | only via `needs-run`                    | only via `needs-run`                                   | always a vessel                               | via `needs-run`                      |
| Review stops                 | 1                                       | 1                                                      | 3                                             | 1                                    |
| Persona loaded by            | task body                               | Ruler                                                  | each task body                                | task body                            |
| Needs an interactive session | no                                      | no                                                     | no                                            | for approval only                    |
| Build-order step             | 2                                       | 1 and 2                                                | 3                                             | 4                                    |

A is the default and needs nothing new. The Shadow must read criteria from the task body, never from the Creator's message; a Shadow briefed by the Creator is a mirror. B is for a domain whose specs keep coming back thin; its risk is a Ruler whose context fills with the Creator's transcript and starts judging, so the Shadow stays a separate delegate. C needs a runner that records cost per vessel (Bakery does) and gives each stage its own diff and cost line; its cost is three Review stops unless unattended review passes the read-only vessels. D is the end state and composes with A or B inside the vessel. The walked ticket is D with A inside.


## Decisions

### Structure

**A Ruler may implement small changes itself.**[^Q34] At most 3 files, no schema or migration, no `.tsx` or mobile UI, no new dependency, no paid-API path. It still writes a short spec and still gets a Shadow. Skip the dispatch, not the record.

**Two new roles only.**[^Q14] Ruler and Magician. Specifying and briefing are skills those roles load.

**The Magician is cross-domain and cross-project.**[^Q25][^Q36] It reads `PROJECT.md` in each repo (tracker, runner, CI, vault page), proposes a batch (issues, domain, order, rough spend), appends it to the vault page, and after approval runs `spec-to-tasks`.

**Dotfiles hold the generic parts; repos hold the specific parts.**[^Q8] Cast and skills: `~/.agents/skills` plus the harness's role config, both chezmoi-managed. Personas, `PROJECT.md`, specs: in each repo.

### Tracker and spec

**Drop Linear. GitHub Issues as the first tracker adapter.**[^Q9][^Q19] The scripts (`check-spec`, `spec-to-tasks`, the state flip) call a `tracker` adapter with four verbs: get issue, set state, add label, create issue. `gh` is the first implementation. Migrate only Linear Todo and In Progress, about 50 issues: title, body, `domain:*` labels, an `imported-from: SIL-nnn` line, one-shot script kept in the repo. Repo tooling that changes: `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md`, the PR-body Linear link rule, `linear-nuke`, task keys.

**Issues carry domain and state.**[^Q20] One `domain:<name>` per issue. State: `needs-spec`, `ready-for-agent`, `ready-for-human`. On GitHub these are labels.

**Specs are tiered.**[^Q3][^Q10] The Ruler decides at spec time.

- Trivial: criteria in the issue body under an `## Acceptance criteria` heading. No file, no spec PR. `spec-to-tasks` reads the issue. Typos, constants, copy, config flags, net additions with no design choice.
- Designed: `docs/specs/<issue>-<slug>.md`, merged by PR. The issue links to it. The task body is generated from it.

`check-spec` validates both shapes. A trivial issue with more than one task, a schema change, or a new dependency is refused and sent to the designed tier.

**Specs are pruned.** Once the work is merged and the code is the record, the spec is history. `docs/specs/` holds only open and recently merged specs; a merged spec moves to `docs/specs/done/` on merge of its last task and is deleted after 90 days by the same workflow. The issue and the PR keep the criteria array, so nothing is lost.

**Required spec sections (revised).**[^Q11] Goal; Non-goals; Acceptance criteria (each with an id); Setup note (data, device, environment a `needs-run` criterion would need; may say `none`); Surfaces touched; Constraints and invariants (from the Persona; may say `none`); Cost and scale (may say `none`). The former Verification section is gone; scope is decided per criterion by the Shadow.

**Spec format.**[^Q31] Frontmatter `issue`, `domain`, `status`, `budget_usd`, `surfaces`; fixed headings; tasks as a checklist, an item may carry `after: <task-id>`. `check-spec` validates `docs/specs/**` in CI and refuses a spec without acceptance criteria.

**You and the Ruler draft together.**[^Q12][^Q21] Interactive agent session, `spec/<issue>` branch, same worktree, you edit the file directly. Lands by PR, Codiff for the walkthrough. Merging is the approval.

**Merge flips the state.**[^Q32] A CI job on merge to `main` that touches a spec with `status: approved` moves the issue from `needs-spec` to `ready-for-agent` through the tracker adapter and comments the spec path. For trivial issues you flip the state by hand after reading the criteria. `spec-to-tasks` refuses anything not `ready-for-agent`.

**One vessel per task.**[^Q22][^Q23] `spec-to-tasks <issue>` creates tasks keyed `gh-<issue>/<task>` with dependency edges, through the runner adapter. Never one task per surface.

**Out-of-scope findings become issues.**[^Q33] Created through the tracker adapter with `needs-spec` and the domain, linked from the PR body.

### Memory and switching

**One vault page per project.**[^Q4][^Q17][^Q35] `🌀 Now/<project>.md` plus `🌀 Now/index.md`. Frontmatter `last_briefed`, `briefing_sources`. Sections: Priority now; In flight; Blocked on me; Decisions pending; Proposed batch (the Magician appends here); Last touched. Issues and PRs appear as bare GitHub URLs; the Obsidian plugin GitHub Link (`github-link`, with a token for private repos) draws each as a badge with title, state and checks, so the page carries only what the badge does not. Suggested, not required; the page reads fine as plain links.

**Briefing is a skill, run on demand.**[^Q7][^Q27] Inputs: the tracker adapter (open PRs, CI state, issues by state), the runner (tasks, runs, cost), and the page's previous state so it can say what changed. Grafana and Sentry join after two weeks of the cheap sources being right. Must work in print mode and never rely on a terminal UI to show its result.

**The Magician is a resumed agent session.**[^Q26][^Q42] Its contract is its inputs and the `🌀 Now/` page it writes. Where it runs is a choice per day: a resumed session in a terminal, a herdr tab, a headless cron on mochi, later a Bakery room. A Ruler you collaborate with is the same kind of session. Rulers inside a vessel are ephemeral delegates.

**Bakery is the first runner.**[^Q41] A Bakery card is a vessel. `bakery-cli` covers the four verbs (`create --key`, idempotent; `depend`; Review; retry in the same session) and adds a cost line per run (`runs`) and a spend cap (`pickup --budget`). Hosted Bakery on mochi, `http://mochi:4317`, is canonical for every project. Local boards are scratch and the Magician ignores them.

### Tooling home

**Tooling home.**[^Q43] `check-spec`, the spec, Persona, and `PROJECT.md` templates, and the label-flip workflow: a new package in `~/code/clearstack`. `spec-to-tasks` and the `runner` adapter live there too, so no runner owns the script; Bakery is the adapter's first implementation.

**Names.**[^Q40] Files: `docs/personas/<domain>.md`, `PROJECT.md`. Roles: see decision 5.


## What gets built

Dotfiles: Ruler and Magician roles; `spec` skill (the spec format[^Q11]); `briefing` skill (the briefing inputs[^Q27]); the Shadow's verdict contract in its role prompt.

clearstack, new package: `check-spec` (both spec tiers); the `tracker` adapter with a `gh` implementation; `spec-to-tasks` and the `runner` adapter with a Bakery implementation; spec, Persona, `PROJECT.md` templates; state-flip and spec-prune workflows.

Bakery, as a runner: store the `criteria` array on the task; start a Trickster vessel when any verdict is `needs-run`.

silk-remix: six Personas under `docs/personas/` (ingestion-search, mobile, web, api-contracts-shared, infra-ci-release, billing-insights-console), drafted by an Explorer from `docs/agent-map/`, `CODEBASE_OVERVIEW.md`, ADRs, `notes/03 Landscape/`; you edit invariants and standing questions[^Q28]. `PROJECT.md`. Linear migration script.

impression, bakery: `PROJECT.md`, `docs/specs/`, a mochi board for impression.

Vault: `🌀 Now/index.md`, `🌀 Now/silk.md`, `🌀 Now/impression.md`, `🌀 Now/bakery.md`.


## Build order

From the interview.[^Q30]

1. Ruler role, `spec` skill, ingestion-search Persona.
2. SIL-258 (SSE connections cut at about 125 s) through the loop by hand, composition A: spec PR, one vessel by hand (a plain session will do), Creator, Shadow with criteria. Measure reconnects per hour before and after, and how often the Shadow's `unmet` and `needs-run` are right.
3. `check-spec`, label-flip workflow, `spec-to-tasks`. Redo step 2's task creation through the script.
4. Magician role, `briefing` skill, Silk `PROJECT.md`, its vault page. Use the Magician for one week.
5. Migrate Linear, add labels, retire `linear-nuke`.
6. The other five Silk Personas.
7. `PROJECT.md`, `docs/specs/`, mochi board for impression and bakery[^Q38].
8. Bakery stores criteria; Trickster vessel on first `needs-run`; later, block Done on `unmet`.


## Decide

1. Which composition for step 2. Proposed: A.
2. Whether a spec author may pre-mark a criterion `needs-run` for known device or data needs, or only the Shadow may.
3. Whether the Trickster is a role or only a vessel.
4. Whether Ruler is a role or a skill a Creator loads, pending the check on whether the harness's role config accepts new names and on disabling competing presets.
5. Whether archetype names replace the wire names in role prompts. Agents following `clear-voice` will push back on metaphor in prompts; wire names may be better on the wire and archetypes on paper.


## Open, not decided

- Where the current harness defines subagent roles, and whether third
party presets there are disabled. A lookup.
- How a vessel loads the Ruler when its task needs domain context.
Probably the task body names the Persona path.
- Whether silk-remix's `ops-alert` issues get a `domain:*` label or stay
outside the taxonomy.

[^Q1]: [[Interview 2026-11-10#Q1|Q1]]
[^Q2]: [[Interview 2026-11-10#Q2|Q2]]
[^Q3]: [[Interview 2026-11-10#Q3|Q3]]
[^Q4]: [[Interview 2026-11-10#Q4|Q4]]
[^Q5]: [[Interview 2026-11-10#Q5|Q5]]
[^Q6]: [[Interview 2026-11-10#Q6|Q6]]
[^Q7]: [[Interview 2026-11-10#Q7|Q7]]
[^Q8]: [[Interview 2026-11-10#Q8|Q8]]
[^Q9]: [[Interview 2026-11-10#Q9|Q9]]
[^Q10]: [[Interview 2026-11-10#Q10|Q10]]
[^Q11]: [[Interview 2026-11-10#Q11|Q11]]
[^Q12]: [[Interview 2026-11-10#Q12|Q12]]
[^Q13]: [[Interview 2026-11-10#Q13|Q13]]
[^Q14]: [[Interview 2026-11-10#Q14|Q14]]
[^Q15]: [[Interview 2026-11-10#Q15|Q15]]
[^Q17]: [[Interview 2026-11-10#Q17|Q17]]
[^Q19]: [[Interview 2026-11-10#Q19|Q19]]
[^Q20]: [[Interview 2026-11-10#Q20|Q20]]
[^Q21]: [[Interview 2026-11-10#Q21|Q21]]
[^Q22]: [[Interview 2026-11-10#Q22|Q22]]
[^Q23]: [[Interview 2026-11-10#Q23|Q23]]
[^Q24]: [[Interview 2026-11-10#Q24|Q24]]
[^Q25]: [[Interview 2026-11-10#Q25|Q25]]
[^Q26]: [[Interview 2026-11-10#Q26|Q26]]
[^Q27]: [[Interview 2026-11-10#Q27|Q27]]
[^Q28]: [[Interview 2026-11-10#Q28|Q28]]
[^Q29]: [[Interview 2026-11-10#Q29|Q29]]
[^Q30]: [[Interview 2026-11-10#Q30|Q30]]
[^Q31]: [[Interview 2026-11-10#Q31|Q31]]
[^Q32]: [[Interview 2026-11-10#Q32|Q32]]
[^Q33]: [[Interview 2026-11-10#Q33|Q33]]
[^Q34]: [[Interview 2026-11-10#Q34|Q34]]
[^Q35]: [[Interview 2026-11-10#Q35|Q35]]
[^Q36]: [[Interview 2026-11-10#Q36|Q36]]
[^Q37]: [[Interview 2026-11-10#Q37|Q37]]
[^Q38]: [[Interview 2026-11-10#Q38|Q38]]
[^Q40]: [[Interview 2026-11-10#Q40|Q40]]
[^Q41]: [[Interview 2026-11-10#Q41|Q41]]
[^Q42]: [[Interview 2026-11-10#Q42|Q42]]
[^Q43]: [[Interview 2026-11-10#Q43|Q43]]
