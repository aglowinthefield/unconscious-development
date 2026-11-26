---
name: persona
description: Draft or grow a domain's Persona (docs/personas/<domain>.md) from the code, so agents know a domain's scope and the rules it must never break. Use when setting a repo up for Unconscious Development, when a spec names a domain with no Persona, when the user says "draft the persona for X", or when promoting proposed invariants after a review.
---

# Persona

A Persona is what an agent reads first to work in one domain: what the domain covers, the rules it refuses to break, and how to run things there. You draft it from the code. The Self confirms it. It then grows from reviews.

## Draft one

1. Find the domain's code. If the Self named only a domain, search for its directories, modules and tests, and send Explorers when the repo is large. Write the paths you settle on under Scope and Key files.
2. Copy `templates/persona.md` from the spec skill's directory (`skills/spec/templates/persona.md`) to `docs/personas/<domain>.md`, unless `unconscious init` already did. Keep `status: draft`.
3. Find invariants: rules the code already enforces or depends on, where breaking one would be a bug, not a style choice. Look in validation and guards, database constraints, tests that assert a limit or an order, comments that say "must" or "never", ADRs, and incident fixes in the git log. Write three to eight. More is noise.

   Lifecycles hide the rules that break most often. Look for state spread across status fields, related booleans, retries, timers, subscriptions, locks, queues, and hand-offs between client, server, worker and database. For each one, write down its phases and the events that move it between them. Then ask what must never happen: two phases at once, an event accepted in a phase where it means nothing, a phase with no way out, a late result written over a newer one, a write without its side effect after a crash. A rule the code enforces is an invariant. A rule the code relies on but doesn't enforce goes under Proposed invariants, with the sequence of events that breaks it.
4. Write each as a table row: id (`I1`, `I2`, …), the rule in one sentence plus its why, and its sources. Link each source to the repo's remote when it has one (`https://github.com/<owner>/<repo>/blob/<default-branch>/<path>#L<n>`), else give the path. A rule you couldn't source isn't an invariant yet; put it under Proposed invariants with what you'd need to confirm it.
5. Fill How to run things here from the repo's scripts, README and CI. The Trickster sets up from that section, so name commands, not intentions.
6. Leave `status: draft`. A draft doesn't block plans: `check-spec` warns until the Self confirms it.

Reply with the path, each invariant in one line, and anything you couldn't place.

## Grow one

Creators add rules a review turned up under `## Proposed invariants`, each with the PR and the code that relies on it. When the Self asks you to go through them, or when you open a domain's Persona for a spec and find some:

- For each, say whether the code really enforces or depends on it, with `path:line`.
- Promote the ones the Self accepts to the Invariants table with the next free id. Ids are permanent; never reuse one.
- Delete the ones the Self rejects.
- When the Self confirms the table, set `status: confirmed`.
