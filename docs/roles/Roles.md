The dispatchable cast of [[Unconscious Development]], as agent files for the harness. Each file is one role, named for its archetype: frontmatter for the harness, body for the prompt.

| File | Model | Thinking | Writes |
|---|---|---|---|
| [[explorer]] | inherit | low | no |
| [[sage]] | inherit | high | no |
| [[ruler]] | inherit | high | specs, small changes |
| [[creator]] | inherit | medium | yes |
| [[shadow]] | inherit | high | no |
| [[trickster]] | inherit | high | scratch only |

`inherit` means the session's model. The Shadow and Trickster are never on a weaker model than the Creator and always think harder. A dispatch may lower the Creator to `low` for a small task (Q34's limits) and raise the Explorer to `medium` when the answer means piecing evidence together. It may not lower the Shadow or Trickster.

Where the harness can reach more than one model family, send the Shadow and Trickster on a different family from the one that wrote the change (Claude-written work reviewed by GPT, and the reverse), at that family's strongest model. A reviewer from the Creator's family tends to share its blind spots. The role files keep `inherit` so they work on any install; choose the reviewer's model at dispatch.

The Self and Magician aren't here. You are the Self. The Magician is the `propose` skill (`skills/propose/`) run in a session. The Ruler loads the `spec` skill from `skills/spec/` and may send only an Explorer, a Sage or a Shadow.

The format is pi-subagents'. `bin/unconscious enable` links these files into `~/.pi/agent/agents/unconscious/` and each `skills/<name>/` into `~/.agents/skills/`, hides pi-subagents' builtin presets and turns off billion-context's `acp_delegate`, so only the cast is reachable. `bin/unconscious disable` undoes all three; `bin/unconscious status` shows what's on. Both take effect in new sessions.

`bin/unconscious enable --harness claude` writes each role into `~/.claude/agents/` instead, as a Claude Code subagent: same name, description and body, Claude's tool names, and no pi-only keys. The Ruler and Creator keep every tool, because in Claude Code only the main agent can send out others, so they run as the main agent (`claude --agent ruler`). Thinking levels don't carry over. `disable --harness claude` removes only the files it wrote.
