---
status: superseded
superseded-by: "[[Unconscious Development]]"
written: 2026-11-10
relates: "[[Agent team design]]"
---

Four ways to arrange the delegate roles around Bakery's card loop. Read the criteria, then the options, then annotate which fits (`<leader>ya`). Nothing here is built.

## Where the roles come from

The four archetypes (`researcher`, `planner`, `reviewer`, `worker`, plus `oracle`) are Unconscious Development's own role definitions, held in dotfiles and registered with whichever harness is in use. Any subagent presets the harness or its extensions ship compete for the same names and delegation surface and get disabled. Whether the current harness's role config accepts new names such as `lead` and `chief` is unverified. If it cannot, those two are skills loaded by a plain `worker` or `researcher`, which changes nothing below except the mechanism.

## Boundary criteria

A role boundary earns its place only when one of these differs across it. Technical domain (mobile, web, ingestion), repo, and task size do not qualify; charters carry those.

| Criterion | Question | Splits today |
|---|---|---|
| Write permission | Can it change files? | `worker` from the read-only four |
| Output contract | What shape must the result have? | `reviewer` (per-criterion verdicts) from `researcher` (paths and lines) |
| Context isolation | What must it not have seen? | `reviewer` must not see the worker's reasoning; `planner` must not have already chosen |
| Authorization | Can it merge, push, spend, close issues? | Nothing delegated may. This fences `lead` and `chief` |
| Model tier | Does it run on a different model? | Only if the tiers actually differ |

A role boundary that does not change one of these rows is a prompt, not a role.

## The card loop these must fit

```
Triage -> Ready -> Running -> Review -> Done
                      |          |
               (one agent session)  (you, or unattended review)
```

Bakery facts that constrain the options:

- One card is one agent session in one worktree. Delegates inside that session are the only way to have several roles touch one card.
- A finished run reaches Review only. Merge is yours, or unattended review's with a verification command.
- Retry continues the same session. Request changes feeds comments back into it.
- Dependencies cut the next card's worktree from a `main` that already holds the earlier card.
- Card runs see only the repo's `AGENTS.md` and the global one; charters must be named in the card body.

## Option A: solo worker with reviewer inside

The card body is the spec task. The run is a `worker` that reads the charter, implements, and before finishing delegates a `reviewer` with the acceptance criteria. The reviewer's `criteria` array goes in the final report. Bakery's unattended reviewer, if on, runs again outside the session.

```
card -> worker ----------------> report
            \-> reviewer (read-only, fresh context) -/
```

Boundaries used: write permission, context isolation, output contract.

Fits when: specs are small, one task per card, you review every diff yourself.

Cost: one strong-model session plus one reviewer call per card.

Risk: the worker chooses what the reviewer sees. Mitigation is a fixed reviewer task template that reads criteria from the card body, not from the worker's message.

This is build-order step 2 with the smallest change.

## Option B: lead-run card

The card body names the charter and the spec task. The run is a `lead`. It reads the charter, decides whether the task is small enough to do itself (Q34 limits), otherwise dispatches `researcher` for unknowns, `worker` for the change, and `reviewer` for criteria. It writes the report. It cannot push or open PRs, which Bakery enforces anyway.

```
card -> lead -> researcher (optional)
             -> worker
             -> reviewer
             -> report
```

Boundaries used: all five. The lead is on the strongest model; worker and researcher on `auto`.

Fits when: tasks need domain judgement before implementation, or the charter's invariants are easy to violate.

Cost: an extra strong-model layer per card. On a three-file change it doubles spend for no gain, which is why Q34 lets the lead implement small changes directly.

Risk: the lead's context fills with worker transcripts and it starts reviewing instead of dispatching. The `reviewer` must stay a separate delegate with its own context, never the lead reading the diff.

Open: how a card run loads the lead role. Simplest is the card body's first line: `role: lead, charter: docs/domains/ingestion-search/CHARTER.md`.

## Option C: pipeline of cards

Each role is its own card, chained with `depend`. `spec-to-cards` emits a research card (read-only, writes `docs/specs/<issue>-notes.md`), an implementation card, and a verification card that runs the charter's verify section and files issues for anything unmet.

```
research card -> worker card -> verify card -> Review
```

Boundaries used: write permission and output contract, enforced by Bakery rather than by prompts. Each card has its own worktree, session, transcript, and cost line.

Fits when: you want each stage's output as a reviewable diff, and when stages run on different days or machines (mochi for the device verify). Needs no interactive session at all; it is the one option that is Bakery only.

Cost: three worktrees and three sessions per task. Research and verify cards are cheap if they run on `auto`.

Risk: Bakery's Review lane exists per card, so you review three times per task, or let unattended review pass the read-only ones. Also, "retry continues the same session" means a bounced worker card does not re-run research; the research notes must live in the repo, not in a transcript.

This is the only option where the verifier is structurally separate from the reviewer. The design doc's charter "how to verify" section is only honoured if something actually runs it.

## Option D: chief outside, solo inside

The chief is a resumed agent session, never a card. Where it runs is not part of the design: a resumed session in a terminal, a herdr tab, a headless cron on mochi that appends a proposal to the vault page, or later a Bakery colleague room. The contract is the session's inputs and the vault page it writes, not the window it lives in. It reads `PROJECT.md` and the vault `Now/` pages, proposes a batch, and after approval runs `spec-to-cards`. Every card then runs as Option A. Specialisation lives entirely in the charter and spec; no lead role exists.

```
chief (tab) -> spec-to-cards -> [card -> worker + reviewer] x N
```

Boundaries used: authorization (chief proposes, you approve, nothing self-dispatches) and write permission.

Fits when: the spec is good enough that the worker needs no further judgement. Pushes effort to spec-writing time, which you do interactively anyway (Q12).

Cost: lowest per card. The chief's cost is a few proposals a day.

This departs from Q26 and Q42, which name a herdr tab. If herdr is optional, the briefing skill must work in print mode too: it writes the proposal to the `Now/` page and never relies on a terminal UI to show it.

Risk: the chief is one more thing to keep running, unless it runs on a schedule. With a thin spec, the worker guesses and the reviewer catches it late. The lead role from Option B is the fallback when a domain's specs keep coming back thin.

## Side by side

| | A solo + reviewer | B lead-run | C pipeline | D chief + solo |
|---|---|---|---|---|
| New roles needed | none | `lead` | none, needs `verify` task shape | `chief` |
| Sessions per task | 1 | 1 | 3 | 1 |
| Strong-model layers | 1 | 2 | 1 | 1 (+chief) |
| Verifier separate from reviewer | no | no | yes | no |
| Review lane stops per task | 1 | 1 | 3 | 1 |
| Charter loaded by | card body | lead | each card body | card body |
| Bakery changes | reviewer criteria on card | none beyond A | `spec-to-cards` emits chains | none beyond A |
| Matches build order step | 2 | 1 and 2 | 3 | 4 |

## What I would try

Start with A for step 2 (SIL-258) because it needs nothing new. Measure how often the reviewer's `unmet` is right. Add B's `lead` only for the domain whose specs come back thin. Add C's verify card only once a charter has a verify command Bakery can run, since unattended review already has a hook for one. D is the end state the design doc already describes, and it composes with A or B inside the card.

The missing piece in every option is the verifier. Reviewer and verifier differ on output contract (verdict on code versus pass/fail on a command) and on write permission (the verifier may need a scratch database or device). Decide whether that is a role, a card, or Bakery's verification command before step 3.

## Decide

1. Which option for step 2.
2. Whether `researcher`, `planner`, and `oracle` collapse to one read-only role. They differ only on output contract, and weakly.
3. Where the verifier lives.
4. Whether `lead` is a role or a skill a `worker` loads, pending the config check.
