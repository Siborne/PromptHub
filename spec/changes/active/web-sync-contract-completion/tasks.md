# Tasks

## Governance gate

- [x] Correct the `FR -> DES -> TEST -> T` mappings and record the Analyze
  result before implementation continues.
- [x] Record affected areas, tradeoffs, failure behavior, and rollback scope.
- [ ] Complete Converge after the implementation and release records agree.

## P0 implementation

- [x] `T-SYNC-001`: Update the active change docs and shared/desktop backup
  shapes for prompt relations and output formats. Covers `FR-SYNC-001` and
  `DES-SYNC-001`.
- [x] `T-SYNC-002`: Add failing desktop export/restore regression tests, direct
  insert IPC channels, ID-preserving local restore, and fail-before-clear
  preflight. Covers `FR-SYNC-002`, `FR-SYNC-003`, `DES-SYNC-002`, and
  `DES-SYNC-003`.
- [x] `T-SYNC-003`: Extend self-hosted Web payload merge/export/import with
  visibility-safe dependent records and regression tests. Covers
  `FR-SYNC-004` and `DES-SYNC-004`.
- [x] `T-SYNC-004`: Preserve the fields in WebDAV/S3 legacy and incremental
  builders and restore plumbing. Covers `FR-SYNC-005` and `DES-SYNC-005`.
- [x] `T-SYNC-005`: Add legacy/malformed dependency tests, skipped dependency
  counts, and update import diagnostics. Covers `FR-SYNC-006` and
  `DES-SYNC-006`.
- [x] `T-SYNC-006`: Run focused tests, type checks, and release-risk checks;
  update implementation and stable sync knowledge. Covers all `TEST-SYNC-*`.

## Current follow-up tranche

- [x] `T-SYNC-P2-001A`: Add failing incremental data/media integrity tests,
  verify manifest hashes and sizes before restore, and document the failure
  boundary. Covers `FR-SYNC-007` and `DES-SYNC-007`.
- [x] `T-SYNC-P1-003A`: Add failing freshness tests for Skills, Rules, graph
  records, agent snapshots, media references, and settings; extend the local
  timestamp source without changing merge policy. Covers `FR-SYNC-008` and
  `DES-SYNC-008`.

## Remaining backlog after current tranche

- [ ] `T-SYNC-P1-001`: Define MCP/Plugin native restore ownership and overwrite
  policy.
- [ ] `T-SYNC-P1-002`: Add delete tombstones and concurrent-edit conflict rules.
- [ ] `T-SYNC-P1-003`: Add freshness/partial-sync observability and UI states;
  the timestamp coverage itself is implemented by `T-SYNC-P1-003A`.
- [ ] `T-SYNC-P2-001`: Define sensitive-data handling and the remaining
  integrity policy for self-hosted and legacy payloads; incremental
  data/media verification is implemented by `T-SYNC-P2-001A`.
- [ ] `T-SYNC-P2-002`: Align public self-hosted documentation and release notes
  with the actual asset matrix.

## Verification matrix

| Verification | Scope |
| --- | --- |
| `TEST-SYNC-001` | Shared/desktop export shape includes both fields |
| `TEST-SYNC-002` | Desktop restore retains IDs and filters dangling dependencies |
| `TEST-SYNC-003` | Self-hosted Web push/pull preserves fields and visibility |
| `TEST-SYNC-004` | WebDAV/S3 legacy and incremental payloads preserve fields |
| `TEST-SYNC-005` | Legacy payloads and malformed dependencies are safe |
| `TEST-SYNC-006` | Typecheck, focused suites, and release harness status recorded |
| `TEST-SYNC-007` | Incremental data/media integrity is verified before restore |
| `TEST-SYNC-008` | Non-prompt durable changes trigger local freshness detection |

## Exact file inventory for backlog

| Task | Files to change or verify |
| --- | --- |
| `T-SYNC-P1-001` | `apps/web/src/services/agent-assets-sync.ts`, `apps/web/src/services/backup.service.ts`, `apps/web/src/routes/sync.ts`, `apps/desktop/src/renderer/services/database-backup.ts`, `apps/desktop/src/renderer/services/self-hosted-sync.ts`, and matching tests |
| `T-SYNC-P1-002` | `packages/shared/types/sync.ts`, `packages/db/src/schema.ts`, `packages/db/src/init.ts`, `apps/web/src/services/backup.service.ts`, `apps/desktop/src/renderer/services/self-hosted-sync.ts`, and sync tests |
| `T-SYNC-P1-003` | `apps/desktop/src/renderer/services/sync-history.ts`, `apps/desktop/src/renderer/services/periodic-auto-sync.ts`, `apps/desktop/src/renderer/components/settings/DataSettings.tsx`, `apps/web/src/routes/sync.ts`, and UI/service tests |
| `T-SYNC-P2-001` | `apps/desktop/src/renderer/services/s3-sync.ts`, `apps/web/src/services/sync-orchestrator.ts`, `apps/web/src/services/sync-media.ts`, and release/security docs |
| `T-SYNC-P2-002` | `docs/web-self-hosted.md`, `spec/knowledge/behavior/sync.md`, `spec/releases/0.5.9.md`, and Web sync route/UI docs |
| `T-SYNC-P2-001A` | `apps/desktop/src/renderer/services/sync-backup-core.ts`, `apps/desktop/tests/unit/services/sync-backup-core.test.ts`, and manifest/integrity docs |
| `T-SYNC-P1-003A` | `apps/desktop/src/renderer/services/sync-backup-core.ts`, local database snapshot helpers, `apps/desktop/tests/unit/services/sync-backup-core.test.ts`, and sync freshness docs |

## Verification result

- Focused desktop and Web regression suites passed.
- Web sync responses now expose imported/skipped relation and output-format
  counts when graph records are present.
- Desktop graph-bearing fallback restore now fails before clearing local data
  when the direct restore bridge is unavailable.
- Incremental WebDAV/S3 downloads now verify `dataHash` and every media
  hash/size before calling local restore.
- Auto-sync freshness now includes backup records for Skills, Rules, graph
  records, agent libraries, and settings, and reports snapshot-read failures.
- `pnpm verify:release:quick` passed all 18 release checks in 300.5 seconds,
  including 332 desktop files / 2,871 tests, 56 Web files / 337 tests, and
  5 Cloudflare files / 10 tests.
- Docker container smoke remains a CI/host follow-up because Docker is not
  available in the current environment.
