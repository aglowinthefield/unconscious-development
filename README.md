# Unconscious Development

Work that happens below your attention, surfaced only at approval points.

<table>
  <tr>
    <td align="center"><img src="assets/tarot/RWS_Tarot_21_World.jpg" width="100" alt="The World"></td>
    <td align="center"><img src="assets/tarot/RWS_Tarot_01_Magician.jpg" width="100" alt="The Magician"></td>
    <td align="center"><img src="assets/tarot/RWS_Tarot_04_Emperor.jpg" width="100" alt="The Emperor"></td>
    <td align="center"><img src="assets/tarot/RWS_Tarot_00_Fool.jpg" width="100" alt="The Fool"></td>
    <td align="center"><img src="assets/tarot/RWS_Tarot_09_Hermit.jpg" width="100" alt="The Hermit"></td>
    <td align="center"><img src="assets/tarot/RWS_Tarot_03_Empress.jpg" width="100" alt="The Empress"></td>
    <td align="center"><img src="assets/tarot/RWS_Tarot_18_Moon.jpg" width="100" alt="The Moon"></td>
    <td align="center"><img src="assets/tarot/RWS_Tarot_10_Wheel_of_Fortune.jpg" width="100" alt="Wheel of Fortune"></td>
    <td align="center"><img src="assets/tarot/RWS_Tarot_02_High_Priestess.jpg" width="100" alt="The High Priestess"></td>
  </tr>
  <tr>
    <td align="center">Self</td>
    <td align="center">Magician</td>
    <td align="center">Ruler</td>
    <td align="center">Explorer</td>
    <td align="center">Sage</td>
    <td align="center">Creator</td>
    <td align="center">Shadow</td>
    <td align="center">Trickster</td>
    <td align="center">Persona</td>
  </tr>
</table>

A cast of agent archetypes (Self, Magician, Ruler, Explorer, Sage, Creator,
Shadow, Trickster, Persona) runs a loop from approved spec to reviewed
diff. The contract is files and scripts: charters, specs, `🌀 Now/` pages,
`check-spec`, `spec-to-cards`. No harness or UI is a dependency.

Opt-in. Nothing here is loaded by default.

- [docs/Unconscious Development.md](docs/Unconscious%20Development.md): the working doc and current source of truth. As practices get their own file under `docs/`, the matching decisions leave it.
- `docs/archive/`: the interview doc and the composition drafts it grew from. Reference only.

## The cast

| Card | Archetype | Role |
| --- | --- | --- |
| <img src="assets/tarot/RWS_Tarot_21_World.jpg" width="80" alt="The World"> | Self | You. Approves specs, batches, merges. |
| <img src="assets/tarot/RWS_Tarot_01_Magician.jpg" width="80" alt="The Magician"> | Magician | `chief`. Reads every `PROJECT.md` and `🌀 Now/` page, proposes a batch, turns approved specs into cards. |
| <img src="assets/tarot/RWS_Tarot_04_Emperor.jpg" width="80" alt="The Emperor"> | Ruler | `lead`. Holds one domain's charter, dispatches, writes specs, makes small changes. |
| <img src="assets/tarot/RWS_Tarot_00_Fool.jpg" width="80" alt="The Fool"> | Explorer | `researcher`. Reads anything, returns paths and lines, answers questions. |
| <img src="assets/tarot/RWS_Tarot_09_Hermit.jpg" width="80" alt="The Hermit"> | Sage | `planner`. Proposes steps and order, with a reason. |
| <img src="assets/tarot/RWS_Tarot_03_Empress.jpg" width="80" alt="The Empress"> | Creator | `worker`. Changes files, runs tests, reports. |
| <img src="assets/tarot/RWS_Tarot_18_Moon.jpg" width="80" alt="The Moon"> | Shadow | `reviewer`. Sees what the Creator did not want seen; returns per-criterion verdicts with evidence. |
| <img src="assets/tarot/RWS_Tarot_10_Wheel_of_Fortune.jpg" width="80" alt="Wheel of Fortune"> | Trickster | verifier. Runs the criteria the Shadow marked `needs-run` and tries to make them fail. |
| <img src="assets/tarot/RWS_Tarot_02_High_Priestess.jpg" width="80" alt="The High Priestess"> | Persona | A charter or skill. The mask any archetype wears to become a specialist. |

Card images: Rider-Waite deck, 1909, public domain, via Wikimedia Commons.
