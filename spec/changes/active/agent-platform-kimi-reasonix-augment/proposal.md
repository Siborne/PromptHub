# Proposal

## Phase And Status

- Phase: implement
- Status: in-progress
- Primary requirement: `FR-AGENT-PLATFORM-001`
- Exit condition: Qoder remains the canonical Qwen target; Kimi Code CLI,
  Reasonix, and Augment/Auggie are available as built-in Skill platforms with
  verified paths, while incompatible Reasonix Rules/MCP writers stay disabled.

## Why

The current Agent catalog contains Qoder but has no native entries for Kimi
Code CLI, Reasonix, or Augment/Auggie. Their Skills and MCP contracts need
separate verification: Kimi and Augment use documented JSON `mcpServers`,
while Reasonix uses a different TOML plugin schema and directory-based
instruction models.

## Scope

- Add shared platform metadata for Kimi Code CLI, Reasonix, and Augment/Auggie.
- Keep Qoder as the only Qwen platform id and include it in the default order.
- Add provenance-backed official icons for the new targets, with distinct
  fallbacks and a registry uniqueness guard so existing platforms are not
  visually or structurally duplicated.
- Add path, preview, icon, and target-specific MCP regression tests.
- Sync the stable agent asset reference with current official documentation.

## Out Of Scope

- A Reasonix MCP target writer; Kimi and Augment use the verified generic JSON
  `mcpServers` adapter.
- Flattening directory-based rules into a synthetic global Rules file.
- Installing any CLI, managing credentials, session state, hooks, or caches.
- Adding project-scoped distribution workflows to the existing user-root Skill
  installer.

## Risks And Rollback

- Local contracts may change quickly. The integration is additive and every
  root can be overridden through existing settings.
- Removing a platform entry does not delete files already owned by an agent.
- Discovery-only TOML/JSON paths must never be passed to an incompatible MCP
  serializer.
