The dispatchable cast of [[Unconscious Development]], as agent files for the harness. Each file is one role: frontmatter for the harness, body for the prompt. Wire names stay as the file names until decision 5 settles.

| File | Archetype | Model | Thinking | Writes |
|---|---|---|---|---|
| `researcher.md` | Explorer | inherit | medium | no |
| `planner.md` | Sage | inherit | high | no |
| `worker.md` | Creator | inherit | medium | yes |
| `reviewer.md` | Shadow | inherit | high | no |
| `verifier.md` | Trickster | inherit | high | scratch only |

`inherit` means the session's model. The Shadow and Trickster are never on a weaker model than the Creator and always think harder, so a cheaper Creator may take an explicit `model`, and they may not.

The Self, Magician and Ruler aren't here. You are the Self. The Magician is the `briefing` skill run in a session. The Ruler is pending decision 4.

The format is pi-subagents' (`name`, `description`, `tools`, `model`, `thinking`, `systemPromptMode`). The install step links this folder into `~/.pi/agent/agents/` and turns off every other preset.
