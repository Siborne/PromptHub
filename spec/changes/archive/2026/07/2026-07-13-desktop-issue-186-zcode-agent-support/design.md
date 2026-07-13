# Design

## DES-ZCODE-001 Shared platform registry

Add one `zcode` entry to `packages/shared/constants/platforms.ts`. Use the
documented root `~/.zcode`, `skills` as the Skills directory, `AGENTS.md` as
the global rule file, and `cli/config.json` as the user MCP/config path. Do
not invent a Plugin directory.

## DES-ZCODE-002 MCP nested JSON adapter

Extend the shared MCP JSON helpers with a target-aware nested entry accessor.
For `zcode`, the accessor reads and writes `mcp.servers`; other targets retain
their existing top-level keys. Core target status, conflict detection, apply,
remove, import, and sync paths all use this accessor so the source-of-truth
and safety behavior remain shared.

## DES-ZCODE-003 Project and Rules routing

Add a ZCode project preset at `<project>/.zcode/config.json`, a global preset
at `~/.zcode/cli/config.json`, and a `zcode-global` Rules template for
`~/.zcode/AGENTS.md`.

## DES-ZCODE-004 Evidence-limited Plugin boundary

ZCode Plugin documentation confirms a bundled capability concept but does not
currently confirm a stable local package marker/path usable by PromptHub's
distribution service. Keep Plugin support pending rather than generating an
unverified package format.

## Traceability

| Requirement | Design | Verification | Task |
| --- | --- | --- | --- |
| `FR-ZCODE-001` | `DES-ZCODE-001` | `TEST-ZCODE-001` | `T-ZCODE-001` |
| `FR-ZCODE-002` | `DES-ZCODE-002`/`003` | `TEST-ZCODE-002`/`003` | `T-ZCODE-002`/`003` |
| `FR-ZCODE-003` | `DES-ZCODE-003` | `TEST-ZCODE-001` | `T-ZCODE-001` |
| `FR-ZCODE-004` | `DES-ZCODE-004` | `TEST-ZCODE-004` | `T-ZCODE-004` |
