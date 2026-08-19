# CLI Agent Management Delta Specification

## `FR-CLI-AGENT-001`: Agent Inventory And Detail

The CLI MUST expose the same built-in/custom Agent identities and shared capability declarations used by the desktop Agent workspace. `list` MUST support search and managed-Agent filters; `get` MUST return resolved paths, installation/configuration status, lifecycle, and per-capability status. Disabled Agents MUST be hidden by default and queryable explicitly.

### Acceptance Scenarios

- Given Claude and a custom Agent root exist, `agent list --filter installed` returns both with resolved roots.
- Given a platform is disabled, default `agent list` omits it and `agent list --include-disabled` returns it with `enabled: false`.
- Given a name/query matches zero or multiple Agents, `agent get` returns stable not-found or ambiguous usage errors.

## `FR-CLI-AGENT-002`: Shared Visibility Management

The CLI MUST enable and disable built-in and custom Agents through the existing SQLite settings contract. The mutation MUST NOT delete platform assets or runtime data.

## `FR-CLI-AGENT-003`: Agent Configuration Management

The CLI MUST add, update, and delete custom Agent records and configure Agent asset paths. Built-in configuration MUST use `builtinAgentOverrides`; custom configuration MUST use `customAgents`. Custom roots MUST remain unique and required. Built-in Agent deletion MUST be rejected.

### Security And Failure Scenarios

- Absolute, traversal, NUL, or empty relative asset paths are rejected before persistence.
- Duplicate ids and duplicate normalized custom roots are rejected without partially changing settings.
- Deleting a built-in Agent returns a conflict and leaves settings unchanged.

## `FR-CLI-AGENT-004`: Identity Preference

The CLI MUST read and update the existing Codex/ChatGPT display name and icon preference without changing the underlying stable `codex` platform id.

## `FR-CLI-AGENT-005`: Native Config Inspection

The CLI MUST list and read the same bounded Agent-native configuration inventory used by the desktop Agent workspace. Reads MUST use the resolved Agent root and declared config paths, redact recognized secret keys and token values, reject unsafe paths and symlinks, and never mutate the source file.

### Security And Failure Scenarios

- A declared or discovered TOML/JSON/YAML configuration can be listed and read with a stable revision while sensitive values are replaced by redaction placeholders.
- A traversal, absolute, NUL, excluded runtime path, symlink, oversized file, or undiscovered file is rejected without returning file content.
- Disabled Agents remain hidden by default and can be inspected only with explicit `--include-disabled`.
- Missing declared files can appear in the inventory with size `0`, but reading them returns a stable not-found result.

## `NFR-CLI-AGENT-001`: Ownership And Compatibility

The CLI MUST remain a thin command surface in `packages/core/src/cli`. Shared Agent normalization and settings mutations MUST live under `packages/core/src/agent-management`; shared types/capability declarations remain in `packages/shared`. No Electron import, schema change, or runtime asset deletion is allowed.

## Verification

- `TEST-CLI-AGENT-001`: black-box CLI list/get/filter and JSON/table behavior.
- `TEST-CLI-AGENT-002`: enable/disable, custom CRUD, built-in override, reset, and identity persistence/reload.
- `TEST-CLI-AGENT-003`: malformed paths, duplicate id/root, ambiguous selectors, built-in delete, and atomic failure behavior.
- `TEST-CLI-AGENT-004`: Core/CLI typecheck, focused coverage, file-size review, and targeted static scan.
- `TEST-CLI-AGENT-005`: native config list/read, secret redaction, disabled inclusion, missing file, traversal, exclusion, and symlink boundaries.
