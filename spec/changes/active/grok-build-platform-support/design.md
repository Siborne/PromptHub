# Design

## `DES-GROK-001`: Grok Build Built-in Platform

`packages/shared/constants/platforms.ts` owns the built-in platform catalog.
Add the `grok` entry there so existing desktop platform discovery, Skill
distribution, and configuration override consume one shared definition.

## Affected Areas

- Data model: no persisted schema change; existing built-in platform override settings apply by platform id.
- IPC / API: no new channels; existing supported-platform APIs expose the entry.
- Filesystem / sync: user root `~/.grok`; Skills `skills/`; Plugins `plugins/`; Agents `agents/`; commands `commands/`; global rules `AGENTS.md`; configuration previews for `config.toml`, `pager.toml`, `settings.json`, `lsp.json`, and `sandbox.toml`.
- UI / UX: existing Agent and Skill surfaces render the entry with the current Grok icon. The mark follows the xAI brand usage rules and uses separate official black/white treatments for light and dark themes.

## Tradeoffs

- Grok Build can discover project `.grok/skills` and `.grok/config.toml`, but PromptHub's existing built-in platform distribution is user-root based. Project-scoped Grok distribution remains out of scope instead of silently writing repo configuration.
- The documented Grok MCP table is structurally close to Codex but uses `headers` for remote transport while PromptHub's Codex writer uses `http_headers`. The platform exposes `config.toml` as its MCP discovery path, while the separate MCP target preset registry intentionally omits Grok until a dedicated `grok` writer exists.

## Failure And Rollback

- External boundary: filesystem writes use the existing Skill platform service and validation. Agent, command, Plugin, and configuration paths are discovery/configuration surfaces in this change; Plugin package distribution is not enabled without a Grok target adapter.
- Partial failure behavior: existing per-platform result reporting applies; no Grok-specific durable state is created before a successful write.
- Recovery/rollback: disabling or removing the catalog entry does not delete previously distributed Grok files.

## Analyze Result

- Requirement links: `FR-GROK-001`
- Verification links: `TEST-GROK-001`, `TEST-GROK-002`, `TEST-GROK-003`, `TEST-GROK-004`
- Blocking conflicts: no safe MCP serializer currently exists. The feature omits MCP distribution rather than writing invalid configuration.
- Unresolved `[待确认]`: none.

## Traceability

| Requirement | Design | Verification | Task |
| --- | --- | --- | --- |
| `FR-GROK-001` | `DES-GROK-001` | `TEST-GROK-001`, `TEST-GROK-002`, `TEST-GROK-003`, `TEST-GROK-004` | `T-GROK-001` through `T-GROK-009` |
