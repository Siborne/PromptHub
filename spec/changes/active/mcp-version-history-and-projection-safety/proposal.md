# Proposal

## Phase And Status

- Phase: plan
- Status: design-ready
- Primary requirement: `FR-MCPVER-001`
- Related issue: [#203](https://github.com/legeling/PromptHub/issues/203)
- Exit condition: My MCP has formal version history, external Agent/project
  projection creates no persistent backup artifacts, failure paths preserve a
  valid target file, and legacy sidecars have a confirmation-based cleanup
  path.

## Problem

Current MCP behavior conflates three different concepts:

1. `McpLibraryFile.version` is a file-schema version, not user-visible MCP
   history.
2. My MCP has no immutable per-server version records or rollback workflow.
3. Every external target write creates a timestamped
   `*.prompthub-mcp-backup-*` file beside the Agent or project configuration.

The sidecars are not MCP versions. They contain whole target files, including
unrelated Agent settings, and grow outside PromptHub's managed data boundary.
Moving those files into another backup directory would preserve the semantic
error instead of fixing it.

## Product Decision

- My MCP is the source of truth and owns formal MCP version history.
- My MCP definitions and versions are canonical files below `data/mcp`; SQLite
  and renderer state are derived only. Empty credential fields are file-owned
  unconfigured state, while non-empty literal credentials remain device-vault
  owned.
- Agent and project MCP files are derived projections, not history stores.
- Projection safety uses validation, same-filesystem atomic replacement,
  in-operation rollback, and post-write verification. It does not create a
  durable backup file.
- External modifications are handled as conflicts: import the selected MCP
  entry as a new My MCP version, or explicitly overwrite the external entry
  from the current My MCP version.
- Existing PromptHub sidecars are legacy cleanup candidates and are never
  reclassified as MCP versions.

## Scope

### In Scope

- Add immutable, per-server My MCP version history with automatic initial and
  semantic-change versions.
- Add list, detail/diff, manual snapshot, restore-as-new-version, note update,
  and delete operations for MCP versions.
- Remove persistent target backup creation from apply, remove, and target-sync
  workflows.
- Keep byte-identical projection operations as no-ops.
- Define atomic write, post-write verification, in-process rollback, and crash
  reconciliation behavior.
- Deprecate the optional `backupPath` result field without breaking existing
  callers during the compatibility window.
- Add bounded, explicit discovery and confirmation-based cleanup for legacy
  `*.prompthub-mcp-backup-*` sidecars.
- Extend backup/sync/export contracts to include MCP version history under the
  same secret-redaction and encryption rules as the current MCP library.

### Out Of Scope

- Versioning an Agent's entire native configuration file.
- Treating target distribution, target removal, or binding changes as a new My
  MCP server version when the normalized server definition did not change.
- Automatically deleting, moving, or importing legacy sidecars.
- Creating a generic backup browser or retaining a second MCP history system.
- Changing the canonical global or project MCP target paths.

## Compatibility And Migration

- Existing `data/mcp/library.json` version 1 remains readable.
- Migration creates an initial `v1` snapshot for each existing My MCP server,
  then advances the library schema only after all version records verify.
- Empty legacy `env` and header values migrate as explicit file placeholders
  and do not create invalid empty entries in the encrypted secret store.
- Existing Agent/project target files are not rewritten during migration.
- Existing adjacent backup sidecars remain untouched until the user confirms a
  cleanup action.
- `backupPath` remains optional during the compatibility window but new writes
  always omit it. Removal of the field requires a later breaking contract
  change.

## Risks

- Version snapshots can contain the same credential-bearing fields already
  present in the local MCP library. Local permissions and backup/sync redaction
  must cover version files as first-class MCP data.
- Library and history are separate files. A mutation coordinator and startup
  reconciliation are required so interruption cannot leave the current record
  and current-version pointer inconsistent.
- Removing durable target backups means a process crash after a completed
  atomic rename cannot restore the previous external file. The file remains
  structurally valid, and binding reconciliation must report the incomplete
  distribution state instead of silently overwriting it again.
- Legacy cleanup can destroy the only copy a user retained manually. It must be
  previewed and explicitly confirmed, with symlinks and unknown filenames
  rejected.

## Rollback Thinking

- Before release, reverting the implementation retains the existing version-1
  MCP library reader and ignores new history files.
- Library schema migration must preserve an exact pre-migration library copy in
  the existing application upgrade-recovery boundary, not as per-target MCP
  sidecars.
- A failed runtime mutation restores the prior library/version state and exact
  target bytes while the process is alive; temporary files and transaction
  markers are removed after success or recovery.

## Current Discrepancy

The current implementation and the archived MCP management design require a
pre-write target backup. That rule conflicts with this product decision and
with the user's clarified distinction between version history and backup. This
active change is the intended delta; stable MCP knowledge must be updated only
after implementation and convergence.
