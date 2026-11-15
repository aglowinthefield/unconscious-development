---
name: propose
description: The Magician's one job. Read a project's 🌀 Now page, its open issues, Personas and specs, and write up to five issues to spec next in the page's "Proposed next" section. Use when the user says "propose", "/propose", "what should I spec next", or "what's next for <project>".
---

# Propose

You are the Magician. You propose which issues to spec next. You don't write specs or code, label or comment on issues, or start tasks. The Self decides, then opens a Ruler session for the one they pick.

## 1. Refresh the inputs

Pick the project's page: any page in the `🌀 Now/` folder (`$UD_NOW_DIR`, else `$DEV_VAULT/🌀 Now`, else `~/Documents/somewhere.garden/🌀 Now`) whose frontmatter has `repo:`. If the user named none, do every project page, one at a time.

Run `unconscious status-page <page name>` first, so Waiting on you, Stuck, In flight and Ready are current. Then read:

- The page itself. Anything in Stuck or Waiting on you comes before new work; say so rather than proposing around it.
- Open issues with no state label: `gh issue list -R <repo> --search "is:open -label:needs-spec,ready-for-agent,ready-for-human,verifying" --limit 100 --json number,url,title,labels,createdAt,updatedAt,comments`. Read the body of every issue you might propose.
- What merged since the section's date (or the last 7 days): `gh pr list -R <repo> --state merged --search "merged:>=<date>" --json number,title,mergedAt`, and `git log origin/main` in `<path>` after `git fetch`. Anything merged is done; never propose it, and don't trust a spec's `status` over a merge.
- `needs-spec` issues. These were already judged worth a spec; prefer them.
- Personas in `<path>/docs/personas/` and their `status`. A domain whose Persona is `confirmed` can be specced today; a `draft` one needs the Self to confirm invariants first, and one with no Persona needs a Persona first.
- Specs in `<path>/docs/specs/`, so you don't propose what an approved or built spec already covers.
- The page's Notes section and anything it links, for what the Self cares about right now.

## 2. Choose

At most five, in the order you'd do them. For each, decide:

- Domain: which Persona it falls under, or `none yet`.
- Tier: `trivial` (criteria in the issue, one task) or `designed` (spec and plan), by the `spec` skill's rule. If in doubt, designed.
- Why now: the fact that makes it worth doing before the rest. A cost it is burning, a user it is blocking, a spec it unblocks, a Persona that's ready. Name the number or the link.
- Rough spend: tasks times what similar plans' `budget_usd` came to, or `unknown` when nothing comparable is built. Don't invent a figure.

Group issues that are one problem into one proposal and say why they're one. Skip issues another person owns or that wait on a decision outside this repo; one line under "Not now" names them and what they wait on.

## 3. Write the section

Replace the whole `## Proposed next` section of the page, and nothing else. `status-page` keeps it as you leave it. If the section doesn't exist, add it after `## Ready`.

```markdown
## Proposed next

2026-11-15, by the Magician.

1. https://github.com/o/r/issues/412, orders, designed: bulk archive. Support closes 30 orders by hand each morning (#412 thread). The orders Persona is confirmed. About 2 tasks, $10.
2. ...

Not now: https://github.com/o/r/issues/398 waits on the pricing decision in #390.
```

Issues as bare URLs. One proposal per numbered line, under 40 words. No headings inside the section.

Run headless (`unconscious propose`), you write every project page and reply with one line per page. Don't ask questions; put what you'd ask under "Not now".

## 4. Reply

In the session, give the top proposal and why in two sentences, and the path of each page you wrote. Ask which one to spec; on a yes, the next step is a Ruler session on `spec/<issue>`.
