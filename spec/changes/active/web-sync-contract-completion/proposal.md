# Complete Web and Backup Sync Contract

## Why

The repository now has several durable prompt and agent assets, but the sync
providers do not all carry the same snapshot. Prompt relations and output format
items are present in the shared sync type and parser, while desktop backup,
self-hosted Web backup, and WebDAV/S3 payload builders can drop them. This makes
an apparently successful backup restore incomplete.

## Scope and priorities

| Priority | Task | User-visible outcome | Main files |
| --- | --- | --- | --- |
| P0 | Preserve prompt relations and output formats end to end | Backup, self-hosted Web, WebDAV, and S3 round trips keep the same prompt graph and output formats | `apps/desktop/src/renderer/services/database-backup.ts`, `apps/desktop/src/renderer/services/database-backup-format.ts`, `apps/desktop/src/renderer/services/sync-backup-core.ts`, `apps/desktop/src/renderer/services/self-hosted-sync.ts`, `apps/web/src/services/backup.service.ts`, `packages/shared/types/sync.ts` |
| P0 | Preserve stable IDs during restore | Existing links remain valid after restore instead of being recreated with new IDs | `apps/desktop/src/main/ipc/prompt.ipc.ts`, `apps/desktop/src/preload/api/prompt.ts`, `packages/shared/constants/ipc-channels.ts`, backup tests |
| P0 | Add regression coverage for omitted fields and legacy payloads | Older payloads remain importable; new payloads fail loudly if a dependent record is invalid | `apps/desktop/tests/unit/services/database-backup.test.ts`, `apps/desktop/tests/unit/services/sync-backup-core.test.ts`, `apps/desktop/tests/unit/services/self-hosted-sync.test.ts`, `apps/web/src/services/*test.ts` |
| P1 | Reapply MCP/Plugin assets on import with explicit ownership rules | Self-hosted Web restores agent assets without silently overwriting local state | `apps/web/src/services/agent-assets-sync.ts`, `apps/desktop/src/renderer/services/*sync*`, related tests |
| P1 | Add delete tombstones and conflict policy | Deletes and concurrent edits converge predictably instead of being resurrected | `packages/shared/types/sync.ts`, sync orchestrators, DB migrations |
| P1 | Improve sync freshness and observability | Users can see stale, skipped, partial, and conflict states with actionable details | `apps/desktop/src/renderer/services/*sync*`, settings UI, `spec/knowledge/behavior/sync.md` |
| P2 | Harden portable skill and package manifests | Self-hosted deployments can verify source, file, and package integrity | skill/package sync services and release documentation |
| P2 | Align Web UI and release documentation | Web users understand which assets are synced and which are Desktop-owned | `docs/web-self-hosted.md`, Web sync UI, release records |

This change implements the P0 rows first. P1 and P2 remain explicit backlog items
and are not hidden behind the P0 implementation.

## Current follow-up tranche

The next implementation tranche narrows the backlog to two deterministic safety
improvements:

- verify incremental `data.json` and media bytes against the manifest before
  any local restore begins;
- include Skills, Rules, prompt graph/output-format records, agent snapshots,
  media references, and settings in the local freshness decision used by auto
  sync.

Delete tombstones, cross-device conflict resolution, and native MCP/Plugin
reapplication remain separate design work. They change merge ownership and
user-visible data-loss semantics, so this tranche does not silently choose a
policy for them.

## Related release-pending work

The self-hosted Web SQLite stale-lock startup fix is tracked separately in
`spec/changes/active/self-hosted-web-database-lock-recovery/`. It is locally
verified but still needs to be included in a published image; this change does
not duplicate or silently close that release task.

This change is a separate sync-contract change. GitHub issue #185 remains
tracked by `self-hosted-skill-sync-reliability`; this change must not be used to
close that issue or to imply that the Skill-specific release work is complete.

## Risks and rollback

The change extends existing optional snapshot fields and adds direct insert
bridges for restore. Payloads that omit the fields remain valid. Reverting the
change restores the previous behavior but may again lose relations and output
formats on round trip; no existing database rows are rewritten by export.

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

`TEST-SYNC-006` is the release-level verification gate for the complete
change, not a substitute requirement for `FR-SYNC-006`.
