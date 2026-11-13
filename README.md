# Unconscious Development

<p align="center">
  <img src="assets/tarot/RWS_Tarot_21_World.jpg" width="80" alt="Self: The World" title="Self: The World">
  <img src="assets/tarot/RWS_Tarot_01_Magician.jpg" width="80" alt="Magician: The Magician" title="Magician: The Magician">
  <img src="assets/tarot/RWS_Tarot_04_Emperor.jpg" width="80" alt="Ruler: The Emperor" title="Ruler: The Emperor">
  <img src="assets/tarot/RWS_Tarot_00_Fool.jpg" width="80" alt="Explorer: The Fool" title="Explorer: The Fool">
  <img src="assets/tarot/RWS_Tarot_09_Hermit.jpg" width="80" alt="Sage: The Hermit" title="Sage: The Hermit">
  <img src="assets/tarot/RWS_Tarot_03_Empress.jpg" width="80" alt="Creator: The Empress" title="Creator: The Empress">
  <img src="assets/tarot/RWS_Tarot_18_Moon.jpg" width="80" alt="Shadow: The Moon" title="Shadow: The Moon">
  <img src="assets/tarot/RWS_Tarot_Swords_07.jpg" width="80" alt="Trickster: Seven of Swords" title="Trickster: Seven of Swords">
  <img src="assets/tarot/RWS_Tarot_02_High_Priestess.jpg" width="80" alt="Persona: The High Priestess" title="Persona: The High Priestess">
</p>

A cast of agent archetypes takes an issue from approved spec to reviewed
diff. You approve the spec and the merge. In between, `spec-to-tasks` splits
the spec into tasks, a Creator implements each task in its own session and
worktree (a vessel), a Shadow checks the diff against the spec's acceptance
criteria, and a Trickster runs the criteria that reading can't settle.

The contract is files and scripts: Personas, specs, `PROJECT.md`, `🌀 Now/`
pages, `check-spec`, `spec-to-tasks`. No harness, tracker or runner is a
dependency.

Opt-in. Nothing here is loaded by default.

- [docs/Unconscious Development.md](docs/Unconscious%20Development.md): the working doc and current source of truth. As practices get their own file under `docs/`, the matching decisions leave it.
- `docs/archive/`: the interview doc and the composition drafts it grew from. Reference only.

## The cast

| Card | Archetype | Role |
| --- | --- | --- |
| <img src="assets/tarot/RWS_Tarot_21_World.jpg" width="80" alt="The World"> | Self | You. Approves specs and merges. |
| <img src="assets/tarot/RWS_Tarot_01_Magician.jpg" width="80" alt="The Magician"> | Magician | `chief`. Reads every `PROJECT.md` and `🌀 Now/` page, proposes which issues to spec next. |
| <img src="assets/tarot/RWS_Tarot_04_Emperor.jpg" width="80" alt="The Emperor"> | Ruler | `lead`. Holds one domain's Persona, dispatches, writes specs, makes small changes. |
| <img src="assets/tarot/RWS_Tarot_00_Fool.jpg" width="80" alt="The Fool"> | Explorer | `explorer`. Reads anything, returns paths and lines, answers questions. |
| <img src="assets/tarot/RWS_Tarot_09_Hermit.jpg" width="80" alt="The Hermit"> | Sage | `sage`. Proposes steps and order, with a reason. |
| <img src="assets/tarot/RWS_Tarot_03_Empress.jpg" width="80" alt="The Empress"> | Creator | `creator`. Changes files, runs tests, reports. |
| <img src="assets/tarot/RWS_Tarot_18_Moon.jpg" width="80" alt="The Moon"> | Shadow | `shadow`. Sees what the Creator did not want seen; returns per-criterion verdicts with evidence. |
| <img src="assets/tarot/RWS_Tarot_Swords_07.jpg" width="80" alt="Seven of Swords"> | Trickster | `trickster`. Runs the criteria the Shadow marked `needs-run` and tries to make them fail. |
| <img src="assets/tarot/RWS_Tarot_02_High_Priestess.jpg" width="80" alt="The High Priestess"> | Persona | `docs/personas/<domain>.md`. The file any archetype reads first to become a specialist in that domain. |

Card images: Rider-Waite deck, 1909, public domain, via Wikimedia Commons.
