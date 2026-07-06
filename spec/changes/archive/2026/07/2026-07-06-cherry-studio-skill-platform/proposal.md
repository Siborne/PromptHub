# Proposal

## Why

Cherry Studio stores agent skills under its application data directory, and users need PromptHub to manage those skills through the same Agent Skill surface as Claude Code, Codex, Cursor, and other built-in platforms.

## Scope

- In scope:
  - Add Cherry Studio as a built-in skill platform.
  - Resolve the default Cherry Studio skill storage path from platform metadata.
  - Register installed skills in Cherry Studio's SQLite registry.
  - Treat `Data/Skills` as storage only, not as the source of truth for installed status.
  - Cover the Windows `%APPDATA%\CherryStudio\Data\Skills` path with tests.
  - Reuse existing platform settings and agent skill management flows where possible.
- Out of scope:
  - Managing Cherry Studio non-skill data.
  - Enabling / disabling a skill for a specific Cherry Studio agent from PromptHub.

## Risks

- Non-Windows default paths may need user override if Cherry Studio changes its `userData` storage layout.
- Using a built-in platform entry means Cherry Studio will appear anywhere PromptHub lists built-in agents.
- Direct SQLite writes can fail while Cherry Studio has its database locked; the integration should surface that failure instead of pretending the folder copy succeeded.

## Rollback Thinking

Remove the Cherry Studio platform entry and associated tests. Existing custom agent support remains available for users who manually configure the path.
