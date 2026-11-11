---
status: superseded
superseded-by: "[[Unconscious Development]]"
written: 2026-11-10
relates: "[[Agent team design]]", "[[Agent team compositions]]"
---

# Agent team compositions, Jungian edition

Same four compositions as [[Agent team compositions]], renamed and reframed with archetypes. The operational boundaries do not change. The archetypes are a naming layer that makes the boundary question easier to argue about: "should the Shadow ever share a context with the Creator" is a sharper question than "should the reviewer see the worker's transcript".

A note on provenance. Jung named a handful of archetypes (Self, Shadow, Persona, Anima and Animus, Trickster, Wise Old Man, Great Mother, Hero). The twelve-archetype wheel (Explorer, Sage, Ruler, Creator, Magician and so on) is a later derivation by Pearson and Mark. This document uses both, labelled.

## The cast

| Archetype | Source  | Today's role                  | What it may do                                                                      | What it must not do                                       |
| --------- | ------- | ----------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Self      | Jung    | you, the operator             | approve specs, batches, merges                                                      | be delegated. Nothing dispatches itself                   |
| Magician  | Pearson | `chief`                       | read every `PROJECT.md` and vault page, turn approved specs into cards              | write specs or code, start cards                          |
| Ruler     | Pearson | `lead`                        | hold one domain's law (the charter), dispatch, write specs, make small changes      | push, open PRs, hand-write Ready cards                    |
| Explorer  | Pearson | `researcher`                  | read anything, return paths and lines, answer questions                             | write                                                     |
| Sage      | Pearson | `planner`                     | propose steps and order                                                             | choose and then pretend to compare                        |
| Creator   | Pearson | `worker`                      | change files, run tests, report                                                     | review its own work                                       |
| Shadow    | Jung    | `reviewer`                    | see what the Creator did not want seen; return per-criterion verdicts with evidence | see the Creator's reasoning. Fresh context only           |
| Trickster | Jung    | verifier (does not exist yet) | run the criteria the Shadow marked `needs-run` and try to make them fail            | judge code it has not run                                 |
| Persona   | Jung    | a charter or skill            | the mask any archetype wears to become a specialist                                 | be a role. A `mobile-creator` is a Creator wearing a mask |

The Persona row is the design doc's Q2 and Q15 restated: archetypes are generic, charters make them specialists. The Shadow and Trickster rows are the two places where context isolation is the whole point of the role.

## Boundary criteria

A boundary earns its place only when one of these differs across it. Domain, repo, and task size do not qualify; the Persona carries those.

| Criterion         | Splits                                                                    |
| ----------------- | ------------------------------------------------------------------------- |
| Write permission  | Creator from Explorer, Sage, Shadow                                       |
| Output contract   | Shadow (verdicts) from Explorer (paths) from Trickster (pass or fail)     |
| Context isolation | Shadow from Creator. Sage from Explorer, weakly                           |
| Authorization     | Self from everyone. Ruler and Magician stop at proposing                  |
| Model tier        | Ruler and Magician on the strongest model; Creator and Explorer on `auto` |

Explorer and Sage differ only on output contract, and weakly, when either is dispatched alone. They earn separate existence when sequenced: the Sage plans on the Explorer's facts rather than on facts it chose to look for. `oracle` was a third read-only role that differed from the Explorer only in returning an answer instead of paths; it is removed. The Explorer's task sets the output shape.

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

1. Noticing. Magician. A headless morning run reads `PROJECT.md`, open issues, CI state, and yesterday's `Now/silk.md`. It writes a proposal to the page: #412 is small, the orders charter exists, spec it today. No one has acted.
2. Approval. Self. You read the page and say yes to #412. First authorization point.
3. Spec. Self and Ruler, together. Interactive session on `spec/412`. The Ruler wears `docs/domains/orders/CHARTER.md`. It sends an Explorer for the facts (where the list query lives, how single archive works, whether a soft-delete flag exists; paths and lines back). It sends a Sage for the shape (client loop, one mutation, or background job; recommends one, with a reason). You argue with the Ruler, pick the mutation, and the Ruler writes `docs/specs/412-bulk-archive.md` with acceptance criteria and a setup note. PR opened, `check-spec` passes, you merge, label flips to `ready-for-agent`.
4. Cards. Magician. `spec-to-cards` turns the spec into cards. One task, one Creator card; the body names the charter path and the criteria. Option A inside.
5. Making. Creator with Shadow. Bakery starts a session in a fresh worktree. The Creator reads the charter, implements the mutation and the list button, runs tests. Before reporting, it summons a Shadow with the criteria copied from the card body. The Shadow returns `criteria: [{id, verdict, evidence}]`: the 500-id limit is `met`, the audit-log criterion is `met`, "list shows 20 after archiving 30" is `needs-run`. The Creator reports with that array attached. Card moves to Review.
6. Verifying. Trickster. Because one criterion is `needs-run`, a dependent card gets that criterion and the setup note: seed 50 orders, archive 30, assert the list shows 20. Pass or fail, nothing else. Had every criterion been `met`, this step would not exist.
7. Approval. Self. One diff, a verdict array, a verify result. Approve, merge. Second and last authorization point.

What the walk shows:

- Explorer and Sage are separate only in step 3, and only because they are sequenced. In step 5 the Creator needs neither; the spec did that work. The Sage is a role the Ruler uses, not one the Creator uses.
- The Ruler appears once, at spec time, where you are present. For a one-task spec it never appears inside a card. The Ruler's court (Option B) is the spec session, not the card.
- Ruler and Sage both propose. The Sage proposes a plan for one task; the Ruler proposes within a domain's law and carries the Self's argument into the spec. Scope and presence of the Self are the difference.
- Shadow and Trickster are the only roles whose isolation is enforced by something other than a prompt: a fresh delegate context, a separate card.
- The Magician never writes code and never runs a card. It proposes twice (what to do, how to split it); the Self approves twice.

### Verification scope

The spec says what must be true. Who checks each claim is a property of the claim, decided when the diff exists, not a mode the spec picks. The Shadow's verdict has three states:

```
criteria: [{ id, verdict: met | unmet | needs-run, evidence }]
```

`met` and `unmet` need evidence from the diff. `needs-run` means the claim cannot be known by reading, and the evidence field says what would have to run. If any criterion is `needs-run`, a Trickster card follows with exactly those criteria and the spec's setup note. If none, the Shadow's verdict is the whole verification. A package bump comes out as all `met` with no Trickster, without anyone labelling it trivial.

Tests and lint are not verification. The Creator runs them before it reports; CI runs them before merge. Neither reviews the change.

Advice to spec authors, not a rule: write a criterion as a statement about the code ("the mutation rejects more than 500 ids") when reading can settle it, and as given/when/then ("given 50 orders, when 30 are archived, the list shows 20") when only running can. The second shape is what the Trickster will get. A spec needs acceptance criteria; a setup note (data, device, environment) is optional and only matters if a criterion ends up `needs-run`.

Control: a lazy Shadow marks everything `needs-run`. The evidence requirement and your eye on the `needs-run` ratio over the first cards are the check.

## The card loop

```
Triage -> Ready -> Running -> Review -> Done
                      |          |
               (one agent session)  (Self, or unattended review)
```

Constraints from Bakery: one card is one agent session in one worktree; a finished run reaches Review only; retry continues the same session; dependencies cut the next worktree from a `main` holding the earlier card; card runs see only the repo's `AGENTS.md` and the global one, so the Persona must be named in the card body.

## Option A: Creator with its Shadow

The card is a spec task. A Creator reads the charter, implements, and before finishing summons a Shadow with the acceptance criteria from the card body. The Shadow's `criteria` array goes in the report.

```
card -> Creator -------------------> report
             \-> Shadow (fresh context) -/
```

Boundaries used: write permission, context isolation, output contract.

Fits when: specs are small, one task per card, the Self reviews every diff.

Risk: the Creator decides what the Shadow sees. The Shadow task must read criteria from the card body, never from the Creator's message. A Shadow briefed by the Creator is a mirror, not a Shadow.

Build-order step 2 with nothing new.

## Option B: the Ruler's court

The card names the charter. A Ruler reads it, decides whether the task is within Q34 limits and does it, otherwise sends an Explorer for unknowns, a Creator for the change, and a Shadow for the verdict. Bakery already stops the Ruler from pushing.

```
card -> Ruler -> Explorer (optional)
              -> Creator
              -> Shadow
              -> report
```

Boundaries used: all five.

Fits when: the charter has invariants that are easy to break, or the task needs domain judgement before code.

Risk: the Ruler's context fills with the Creator's transcript and it starts judging. The Shadow must stay a separate delegate. A Ruler who reviews is a Ruler without a Shadow, which is the failure mode Jung would predict.

Cost: a second strong-model layer. On a three-file change it doubles spend.

## Option C: the journey

Each archetype gets its own card, chained with `depend`. `spec-to-cards` emits an Explorer card (writes `docs/specs/<issue>-notes.md`), a Creator card, and a Trickster card that runs the criteria the Shadow marked `needs-run` and files issues for anything that fails.

```
Explorer card -> Creator card -> Trickster card -> Review
```

Boundaries used: write permission and output contract, enforced by Bakery rather than by prompt. Each stage has its own worktree, transcript, and cost line.

Fits when: you want each stage as a reviewable diff, or stages run on different machines (mochi for the device verify). Needs no interactive session at all; it is the one option that is Bakery only.

Risk: three Review stops per task unless unattended review passes the read-only cards. Retry continues the same session, so a bounced Creator card does not re-run the Explorer; its notes must live in the repo.

The only option where the Trickster exists at all. A `needs-run` verdict is honoured only if something runs it.

## Option D: the Magician and the Self

The Magician is a resumed agent session, never a card. Where it runs is not part of the design: a resumed session in a terminal, a herdr tab, a headless cron on mochi that appends a proposal to the vault page, or later a Bakery colleague room. The contract is the session's inputs and the vault page it writes, not the window it lives in. It reads `PROJECT.md` and the `Now/` pages, proposes a batch, and after the Self approves, runs `spec-to-cards`. Each card runs as Option A. There is no Ruler; specialisation lives in the charter and the spec.

```
Magician (tab) -> Self approves -> spec-to-cards -> [Creator + Shadow] x N
```

Boundaries used: authorization and write permission.

Fits when: specs are good enough that the Creator needs no further judgement, which pushes effort to spec time, where the Self and a Ruler draft together anyway (Q12).

This departs from Q26 and Q42, which name a herdr tab. If herdr is optional, the briefing skill must work in print mode too, which means it writes the proposal to the `Now/` page and never relies on a terminal UI to show it.

Risk: a thin spec means the Creator guesses and the Shadow catches it late. The Ruler is the fallback for a domain whose specs keep coming back thin.

## Side by side

| | A Creator + Shadow | B Ruler's court | C journey | D Magician + Self |
|---|---|---|---|---|
| New archetypes | none | Ruler | Trickster | Magician |
| Sessions per task | 1 | 1 | 3 | 1 |
| Strong-model layers | 1 | 2 | 1 | 1 (+Magician) |
| Trickster present | no | no | yes | no |
| Review stops per task | 1 | 1 | 3 | 1 |
| Persona loaded by | card body | Ruler | each card body | card body |
| Build-order step | 2 | 1 and 2 | 3 | 4 |

## What I would try

A for step 2 (SIL-258), because it needs nothing new. Measure how often the Shadow's `unmet` is right. Add the Ruler only for the domain whose specs come back thin. Add the Trickster card once a Shadow returns its first `needs-run`. D is the end state the design doc describes and composes with A or B inside the card.

The archetype that is missing from every current option is the Trickster. Shadow and Trickster differ on output contract (verdict on code versus pass or fail from running it) and on write permission (the Trickster may need a scratch database or device). Decide whether it is a role or a card before step 3.

## Decide

1. Which option for step 2.
2. Whether `needs-run` should be able to come from the spec author as well as the Shadow, for criteria known in advance to need a device or data.
3. Where the Trickster lives.
4. Whether Ruler is a role or a Persona a Creator wears, pending the check on whether the harness's role config accepts new names, and on disabling any competing subagent presets it ships.
5. Whether these names replace `researcher`, `worker`, `reviewer` in role prompts, or stay a design vocabulary. Agents following `clear-voice` will push back on metaphor in prompts; the operational names may be better on the wire and the archetypes better on paper.
