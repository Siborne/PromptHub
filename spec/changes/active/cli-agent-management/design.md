# Design: CLI Agent Management

## Ownership

- `packages/shared`: existing `SkillPlatform`, Agent settings types, managed-Agent summary and capability inventory.
- `packages/core/src/agent-management`: reusable root/config normalization, settings-table repository, platform composition and resolved inventory.
- `packages/core/src/cli/agent-command.ts`: argument parsing, selectors and presentation only.
- `packages/core/src/cli/run.ts` / `help.ts`: route and discoverability.
- `apps/cli/tests/agent.test.ts`: black-box CLI contract.

## `DES-CLI-AGENT-001`: Inventory Composition

Read Agent-related setting keys from the current runtime SQLite database, compose built-ins from the canonical `SKILL_PLATFORMS` registry with all custom Agent records, resolve current roots, detect root existence, then call `buildManagedAgents`. Add a CLI-only `enabled` projection so disabled records can be explicitly inspected without changing the shared desktop summary contract.

## `DES-CLI-AGENT-002`: Atomic Settings Repository

Mutations read a normalized snapshot, validate the complete next state, and persist all affected compatibility keys in one SQLite transaction. Custom Agent updates synchronize `customAgents` and `customAgentRootPaths`; built-in overrides synchronize `builtinAgentOverrides` and `customPlatformRootPaths`.

No schema migration is required. Existing malformed setting rows fall back to safe defaults for reads; a successful mutation rewrites only the Agent-owned keys involved.

## `DES-CLI-AGENT-003`: Path And Identity Validation

- Root paths are trimmed and may use the existing `~`/platform template conventions.
- Asset/config relative paths are normalized and must not be absolute, contain NUL, or contain `..` segments.
- Custom ids/names/roots are non-empty; ids are unique across built-in and custom identities; custom roots are unique case-insensitively.
- Codex identity choice remains `codex | chatgpt`; the platform id remains `codex`.

## `DES-CLI-AGENT-004`: CLI Contract

```text
agent list [--filter all|installed|configured|custom|not-detected|needs-attention] [--search <query>] [--include-disabled]
agent get <id|name|query> [--include-disabled]
agent enable|disable <id|name|query>
agent add --name <name> --root <path> [--id <id>] [asset path options]
agent update <id|name|query> [--name <name>] [--root <path>] [--enabled|--disabled] [asset path options]
agent configure <id|name|query> [--root <path>] [asset path options]
agent reset <id|name|query>
agent delete <custom-id|name|query>
agent identity get
agent identity set --name codex|chatgpt [--icon codex|chatgpt]
```

`get/list` expose capability truth; they do not synthesize deep Provider/session/usage support. Deep Electron-only adapters remain a recorded follow-up boundary.

## Traceability

| Requirement         | Design                            | Verification                | Task                     |
| ------------------- | --------------------------------- | --------------------------- | ------------------------ |
| `FR-CLI-AGENT-001`  | `DES-CLI-AGENT-001`, `004`        | `TEST-CLI-AGENT-001`        | `T-CLI-AGENT-001`, `003` |
| `FR-CLI-AGENT-002`  | `DES-CLI-AGENT-002`, `004`        | `TEST-CLI-AGENT-002`        | `T-CLI-AGENT-002`, `003` |
| `FR-CLI-AGENT-003`  | `DES-CLI-AGENT-002`, `003`, `004` | `TEST-CLI-AGENT-002`, `003` | `T-CLI-AGENT-001`..`003` |
| `FR-CLI-AGENT-004`  | `DES-CLI-AGENT-003`, `004`        | `TEST-CLI-AGENT-002`        | `T-CLI-AGENT-002`, `003` |
| `NFR-CLI-AGENT-001` | `DES-CLI-AGENT-001`..`004`        | `TEST-CLI-AGENT-004`        | `T-CLI-AGENT-004`        |
