# Design

## Affected Areas

- Data contract: `packages/shared/types/sync.ts` and provider payload adapters.
- Desktop restore: backup validation, main-process IPC, and restore diagnostics.
- Web restore: `BackupService`, sync routes, visibility checks, and summaries.
- Provider IO: WebDAV/S3 legacy and incremental backup builders.
- Verification: desktop, Web, provider serialization, and release harness tests.

## `DES-SYNC-001` Shared contract is the source of truth

Reuse the optional `promptRelations` and `outputFormatItems` fields already
defined in `packages/shared/types/sync.ts`. Extend the desktop
`DatabaseBackup` shape from those shared types instead of introducing a second
provider-specific schema.

## `DES-SYNC-002` Desktop export and ID-preserving restore

`database-backup.ts` exports both collections from the local database. Restore
uses direct insert IPC operations that accept the persisted ID, while retaining
the existing create operations for normal user mutations. Each direct database
statement is atomic; the current desktop restore orchestration is not one
cross-entity transaction. A graph-bearing payload must pass bridge-capability
and dependency preflight before any local data is cleared. Web import remains
wrapped in the existing database transaction.

The new IPC surface is intentionally small:

- `prompt:relation:insert-direct`
- `prompt:output-format:insert-direct`

The main process calls the DB layer's existing direct insert primitives; no
renderer-owned SQL is introduced.

## `DES-SYNC-003` Dependency filtering

Before restore, derive the set of prompt IDs that survived validation and
visibility filtering. Only relations whose `sourcePromptId` and
`targetPromptId` are in that set are inserted. Output format items use the same
endpoint check. The filter is deterministic and preserves order for valid
records.

## `DES-SYNC-004` Web payload preservation

`BackupService` exports both collections from `PromptRelationDB` and
`PromptOutputFormatDB`. During import it merges prompts first, then inserts only
records whose endpoints are visible to the actor and present after the merge.
The Web service uses direct DB inserts to preserve IDs and keeps the existing
workspace/file synchronization sequence.

## `DES-SYNC-005` Provider adapters

The WebDAV/S3 `BackupData` type already derives from `DatabaseBackup`; update
legacy and incremental builders and restore plumbing so the optional fields are
not dropped when constructing provider payloads.

## `DES-SYNC-006` Compatibility and error behavior

Missing fields normalize to empty collections. Malformed dependent records are
rejected by the provider parser; structurally valid but dangling records are
skipped with imported/skipped diagnostics rather than becoming dangling DB rows.
No migration is required because all records already have stable IDs and the
change only extends serialized payloads.

## Tradeoffs

- The desktop bridge keeps the existing small IPC surface, but full restore
  atomicity is not claimed until a transaction-level restore bridge exists.
- Rejecting graph-bearing fallback restores is safer than clearing data and
  silently recreating records with new IDs.
- Web visibility filtering may intentionally omit relations whose endpoints are
  outside the actor's export scope.

## Failure And Rollback

- Missing desktop direct-insert capabilities: fail before clearing local data.
- Malformed payload: reject at the provider parser boundary.
- Dangling dependency: skip and include the skipped count in diagnostics.
- Web transaction failure: roll back database rows and restore written media
  through the existing route rollback hook.

## Analyze Result

- Requirement links: all `FR-SYNC-*` entries map to a design, verification, and
  executable task; release verification is tracked separately by
  `TEST-SYNC-006`.
- Verification links: desktop, Web, provider, and release checks are listed in
  `tasks.md`.
- Blocking conflicts: the desktop restore is not cross-entity transactional;
  the implementation must use preflight/fail-before-clear until that boundary
  is changed.
- Unresolved `[待确认]`: none for the implemented contract; MCP/Plugin
  reapply, tombstones, conflict resolution, and encryption policy remain
  backlog.

## Traceability

| Requirement | Design | Verification | Task |
| --- | --- | --- | --- |
| `FR-SYNC-001` | `DES-SYNC-001` | `TEST-SYNC-001` | `T-SYNC-001` |
| `FR-SYNC-002` | `DES-SYNC-002` | `TEST-SYNC-002` | `T-SYNC-002` |
| `FR-SYNC-003` | `DES-SYNC-003` | `TEST-SYNC-002` | `T-SYNC-002` |
| `FR-SYNC-004` | `DES-SYNC-004` | `TEST-SYNC-003` | `T-SYNC-003` |
| `FR-SYNC-005` | `DES-SYNC-005` | `TEST-SYNC-004` | `T-SYNC-004` |
| `FR-SYNC-006` | `DES-SYNC-006` | `TEST-SYNC-005` | `T-SYNC-005` |
| `FR-SYNC-007` | `DES-SYNC-007` | `TEST-SYNC-007` | `T-SYNC-P2-001A` |
| `FR-SYNC-008` | `DES-SYNC-008` | `TEST-SYNC-008` | `T-SYNC-P1-003A` |

## Deferred design decisions

MCP/Plugin native reapply, delete tombstones, conflict resolution, encryption,
and freshness UI are P1/P2 follow-ups. They are listed in `proposal.md` so the
current implementation does not silently imply that a complete bidirectional
sync already exists for those assets.

## Follow-up tranche design

### `DES-SYNC-007` Manifest integrity preflight

Incremental download must verify the exact serialized `data.json` bytes against
`manifest.dataHash`. It must also download and verify every manifest-listed
image/video against both `hash` and `size` before calling `restoreFromBackup`.
Any missing or mismatched entry fails the operation without clearing or writing
local records. Verified media is then written after the database restore using
the existing media writers.

### `DES-SYNC-008` Complete freshness input set

The local auto-sync timestamp must be derived from every durable snapshot
surface that can change without a prompt/folder mutation: Skills, Skill files
and versions, Rules, prompt relations, output-format items, MCP/Plugin/agent
snapshots, media references, and settings. The implementation may use the
latest timestamp available from each existing local source; it must not invent
per-asset clocks or alter merge semantics.

### Follow-up failure and rollback

- A data or media integrity mismatch returns a failed sync result before local
  restore starts.
- A freshness read failure is reported as an auto-sync failure rather than
  silently treating the workspace as unchanged.
- Tombstones, conflict resolution, and native agent reapply remain outside this
  tranche because their rollback behavior requires a separate product policy.
