---
status: needs-review
proposed: 2026-11-16
revises: "[[Unconscious Development]]"
---

UD's state lives in the repo. Trackers and document tools are adapters that mirror it or render it, and none of them is needed to work. Today the same work shows up as GitHub labels, PR threads, Now-page sections written only in the vault, and `Specs.base` reading whatever branch the local clone has checked out. Nothing says which copy is current.

This note gives each kind of state one home and makes every view say how fresh it is.

## Where state lives

| State | Home | Today |
|---|---|---|
| Specs, plans, Personas | `docs/specs/`, `docs/personas/` | same |
| Task state | the plan's checklist | same |
| An item: its state (`needs-spec`, `ready-for-agent`, `ready-for-human`, `verifying`, `proposed`), domain, and trivial-tier criteria | `docs/work/<slug>.md`, one file per item | GitHub issue labels and body |
| Proposals | `docs/work/` with `state: proposed` | Proposed next, in the vault only |
| Review talk, PR and CI status | the tracker, read into a local cache | read live by `status-page` |
| Runner tasks and cost | the runner, read into the same cache | not read |

An item has a tracker-neutral slug. Once mirrored, its frontmatter names the tracker's ref (`tracker: github#6571`), so specs and task keys can keep citing issue numbers where a tracker exists.

## Sync

`unconscious sync` runs on the schedule `status-page` uses now. For each adapter it:

1. Pushes the fields the repo owns: item state becomes labels, a new item becomes an issue.
2. Pulls what the tracker owns (comments, PRs, checks, runner tasks) into a cache outside the repo, `~/.local/state/unconscious/<project>/`, stamped with the time of each source's last pull.

A project with no tracker skips sync. Everything below still works from the repo and an empty cache.

## Views

`status` builds one view model per project: each item with its state, who it waits on, its age, its link, and why it is where it is. Adapters render that model and never read it back:

- Terminal: `unconscious status` prints it.
- Obsidian: one note per item under `🌀 Now/<project>/`, with the model's fields as frontmatter so Bases can group and filter across projects (Waiting on you, Stuck, In flight, Ready, Proposed). The Now page becomes a short summary that embeds those views. Generated notes carry `cssclasses: ud-generated` so they look different from notes you write, and anything typed into one is overwritten on the next run.

Every view prints each source's last sync, so a stale cache is visible instead of silently wrong. `Specs.base` reads the Obsidian adapter's spec notes, rendered from `main`, instead of the symlinked working copy.

## Questions

A `[NEEDS CLARIFICATION]` marker is answered by editing the file and committing, in any editor. PR review threads stay as one adapter that makes the same edit for you.

## What this revises in the design doc

- "Issues carry domain and state": the item file carries them, and labels mirror it.
- "One vault page per project": the page is the Obsidian adapter's output, and `now_dir` still has no default.
- "The Magician's contract is its inputs and the page it writes": it writes item files instead.

## Build order

1. The view model and `unconscious status` in the terminal, from today's sources. No new state yet.
2. The Obsidian adapter, one note per item, replacing the sections `status-page` owns.
3. `docs/work/` item files and `unconscious sync` with the GitHub adapter. Labels become a mirror.
4. Proposals as items; the Magician stops writing the Now page.

## Open

1. Which issues become items: only those UD manages (they carry a state), or every open issue? Proposed: only managed ones. Other issues stay in the tracker.
2. When someone changes a repo-owned field on the tracker (relabels an issue on GitHub), does sync commit that change to the item file, or overwrite the label? Proposed: commit it, since teammates work in the tracker.
3. Does a closed item's file stay with `state: closed`, or get deleted like a finished plan? Proposed: deleted; git keeps it, and the cache can still show recently closed items.
4. How do the Magician's daily proposals land: a direct commit to `main`, or a PR you merge? A direct commit is a daily bookkeeping commit; a PR is one more thing to review.
