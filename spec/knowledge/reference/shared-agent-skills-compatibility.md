# Shared Agent Skills Compatibility

This record distinguishes documented discovery from runtime verification for
the experimental user-level `~/.agents/skills` distribution target.

| Agent     | Evidence                                                                           | User-level discovery                              | Runtime status                       | Copy       | Symlink    | Precedence / duplicate behavior | Checked    |
| --------- | ---------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------ | ---------- | ---------- | ------------------------------- | ---------- |
| Gemini    | Official docs: `https://geminicli.com/docs/cli/using-agent-skills/`                | Documented                                        | Unverified                           | Unverified | Unverified | Unverified                      | 2026-07-30 |
| Augment   | Official docs: `https://docs.augmentcode.com/cli/skills`                           | Documented                                        | Unverified                           | Unverified | Unverified | Unverified                      | 2026-07-30 |
| Windsurf  | Official docs: `https://docs.windsurf.com/zh/windsurf/cascade/skills`              | Documented                                        | Unverified                           | Unverified | Unverified | Unverified                      | 2026-07-30 |
| OpenCode  | Official docs: `https://opencode.ai/docs/skills`                                   | Documented                                        | Unverified                           | Unverified | Unverified | Unverified                      | 2026-07-30 |
| Qwen Code | Official docs: `https://qwenlm.github.io/qwen-code-docs/en/users/features/skills/` | Not documented in the current user-level contract | Unsupported as a compatibility claim | Unverified | Unverified | Unverified                      | 2026-07-30 |

`Documented` means the vendor documentation names the shared location. It does
not mean PromptHub has run the corresponding Agent build on macOS, Windows,
and Linux. A row can move to `verified` only after an isolated runtime fixture
records the Agent version, OS, scope, install mode, loaded Skill identity, and
native-versus-shared precedence.

PromptHub exposes `agent-skills-global` as a shared distribution target, not an
Agent platform. Agent inventory, detection, configuration roots, sessions,
models, Rules, MCP, and Plugin counts remain unchanged.
