The dispatchable cast of [[Unconscious Development]], as agent files for the harness. Each file is one role, named for its archetype: frontmatter for the harness, body for the prompt.

| File | Model | Thinking | Writes |
|---|---|---|---|
| [[explorer]] | inherit | low | no |
| [[sage]] | inherit | high | no |
| [[creator]] | inherit | medium | yes |
| [[shadow]] | inherit | high | no |
| [[trickster]] | inherit | high | scratch only |

`inherit` means the session's model. The Shadow and Trickster are never on a weaker model than the Creator and always think harder. A dispatch may lower the Creator to `low` for a small task (Q34's limits) and raise the Explorer to `medium` when the answer means piecing evidence together. It may not lower the Shadow or Trickster.

The Self, Magician and Ruler aren't here. You are the Self. The Magician is the `briefing` skill run in a session. The Ruler is pending decision 4.

The format is pi-subagents'. `bin/unconscious enable` links these files into `~/.pi/agent/agents/unconscious/`, hides pi-subagents' builtin presets and turns off billion-context's `acp_delegate`, so only the cast is reachable. `bin/unconscious disable` undoes all three; `bin/unconscious status` shows what's on. Both take effect in new sessions.
