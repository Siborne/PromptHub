# Design

## `DES-AGENT-PLATFORM-001`: Conservative built-in platform metadata

`packages/shared/constants/platforms.ts` remains the single source of truth
for built-in Agent roots and Skill directories. The existing installer,
platform visibility, settings overrides, and root preview consume the entries
without a new persistence schema or IPC channel.

### Platform boundaries

- `kimi`: `~/.kimi/skills/`, `~/.kimi/config.toml`, `~/.kimi/mcp.json`.
- `reasonix`: `~/.reasonix/skills/`, `config.toml`, `settings.json`, and
  `trust.json`; `config.toml` is discovery-only because Reasonix `[[plugins]]`
  TOML is not the Codex MCP schema.
- `kimi`: `~/.kimi/skills/` plus the verified JSON MCP target
  `~/.kimi/mcp.json` with top-level `mcpServers`.
- `augment`: `~/.augment/skills/` plus the verified JSON MCP target
  `~/.augment/settings.json` and workspace `.augment/settings.json` with
  top-level `mcpServers`; `.augment/rules/` is a directory protocol and is not
  represented by the single-file Rules registry.
- `qoder`: existing `qoder` id remains canonical; no `qwen` alias is added.

### Icon boundary

The renderer uses provenance-backed official marks for all three new visual
targets: the Reasonix mark from its current `main-v2` source tree, Augment's
official favicon SVG, and Kimi's official site favicon. Lucide fallbacks remain
distinct per platform so a missing asset cannot make Kimi and Auggie look like
the same target. Platform ids remain unique in the built-in registry.

### Compatibility and failure behavior

The existing built-in root override and user-root Skill copy behavior apply.
No credentials, runtime state, sessions, caches, or rule directories are
written. Kimi and Augment MCP projections only merge the documented
`mcpServers` object; Reasonix remains excluded from target presets.

## Analyze Result

- Requirement links: `FR-AGENT-PLATFORM-001`, `FR-AGENT-PLATFORM-002`
- Verification links: `TEST-AGENT-PLATFORM-001` through
  `TEST-AGENT-PLATFORM-004`
- Blocking conflicts: Reasonix has no safe shared MCP writer and the three
  platforms have no single canonical global Rules file. Kimi and Augment use
  the verified generic JSON adapter; Reasonix remains discovery-only.
- Unresolved `[待确认]`: none.

## Traceability

| Requirement | Design | Verification | Task |
| --- | --- | --- | --- |
| `FR-AGENT-PLATFORM-001` | `DES-AGENT-PLATFORM-001` | `TEST-AGENT-PLATFORM-001`, `TEST-AGENT-PLATFORM-002` | `T-AGENT-001` through `T-AGENT-003` |
| `FR-AGENT-PLATFORM-002` | `DES-AGENT-PLATFORM-001` | `TEST-AGENT-PLATFORM-003`, `TEST-AGENT-PLATFORM-004` | `T-AGENT-004` through `T-AGENT-006` |
