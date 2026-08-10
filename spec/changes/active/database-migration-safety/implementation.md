# Data Storage And Database Migration Safety Implementation

## Status

Current storage/migration audit, requirements, target design, verification
matrix, and phased task plan are complete. Production persistence code has not
been changed in this iteration. Implementation is intentionally blocked.
Pending decisions are `COMPAT-DATA-001` and `COMPAT-DATA-002`.
`COMPAT-DATA-003` was confirmed on 2026-08-10; implementation must still pass
the staged rebuild and rollback gates before switching authority.

## Completed In This Iteration

- Mapped the actual storage roots and fallbacks for Desktop, CLI, self-hosted
  Web, shared SQLite, Skills, Prompts, media, generations, config, secrets,
  backups, recovery candidates, and browser/runtime state.
- Audited renderer persistence key-by-key and separated disposable UI/cache
  state from settings, credentials, sync identities, marketplace sources,
  Prompt variable history, recovery paths, and legacy IndexedDB recovery data.
- Recorded that current Prompt workspace files omit database-only state and are
  not yet sufficient to rebuild Prompt relations, output-format links, usage
  fields, or planned multi-message data without loss.
- Separated five artifact semantics that were previously all described as
  backups: domain version history, ephemeral projection rollback, managed safety
  points, portable snapshots, and recovery candidates.
- Recorded fifteen current storage findings and ten current database-migration
  findings against production code.
- Defined a process-immutable root/layout context and explicit product topology
  instead of claiming one physical layout across Desktop, Web, mobile, and D1.
- Defined staged root migration with source preservation, bounded inventory,
  capacity/security checks, atomic pointer/layout publication, and crash
  recovery.
- Defined a SQLite-consistent allowlisted safety point, device/portable secret
  policy, journaled cross-domain restore, bounded streaming export, and managed
  recovery artifact registry.
- Defined an ordered SQLite manifest, numeric compatibility gate, checksummed
  history, migration leadership, host reconciliation, and Desktop stage
  coordinator.
- Preserved ownership of MCP history/projection cleanup, generation storage,
  sync contracts, Agent configuration, Git transport, and historical fixtures in
  their existing active changes.
- Added complete `FR-DATA -> DES-DATA -> TEST-DATA -> T-DATA` traceability beside
  the existing database migration chain.

## Baseline Verification Already Run

- Static source audit: completed against current runtime paths, data-root
  change, layout migration, shared SQLite initialization/adapter, upgrade
  snapshot/restore, database recovery, portable export/restore, MCP projections,
  Agent config backups, self-hosted Web paths, and secret/config storage.
- Existing Desktop migration baseline: 29 tests passed across migration locks,
  upgrade-startup snapshots, and data-layout migration. This is baseline
  evidence only; it does not prove the newly specified staged root/restore or
  consistent snapshot contracts.
- Existing CLI concurrency baseline: 21 tests passed, including bounded busy
  handling, lease cleanup, prepared-statement finalization, and overlapping
  writers. This is baseline evidence only.
- `pnpm spec:test` passed after the file/SQLite/renderer hierarchy update,
  including governance, generated change inventory, and traceability validation
  for 22 active changes.
- `pnpm spec:index:check` and the focused Prettier check passed after the same
  update.

## Known Current Production Risks

- A process can bind a mixed canonical/legacy layout through independent path
  fallbacks.
- Root migration and full restore can leave partial target/domain state after a
  failure or crash.
- Live SQLite files are copied by several backup/recovery paths without a proven
  consistent snapshot primitive.
- Portable exports can over-read unselected domains and materialize large
  content in memory without one consistency identity.
- MCP projections no longer create new sidecar backups in the current working
  implementation. Legacy MCP sidecars still require explicit previewed cleanup;
  Agent mutations and raw database migration/recovery copies remain unbounded.
- Plaintext AI provider keys make broad config backup/export unsafe.
- Renderer LocalStorage can retain WebDAV/S3/provider/proxy credentials because
  only the GitHub token is removed by the current persistence filter.
- Settings currently have competing renderer LocalStorage, SQLite, and
  `config/ai-models.json` owners with non-atomic merge directions.
- Clearing browser data can lose non-cache state such as marketplace sources,
  device identities, Prompt variable history, and recovery paths.
- Prompt files cannot yet reconstruct all local relational state, so an
  immediate file-first cutover would silently lose data.
- A caught database migration error can commit earlier work; CLI/Web ordering
  can suppress Desktop-only reconciliation; newer schemas are not rejected by
  an ordered compatibility version.

## Not Yet Implemented

- No runtime path, database schema, migration, restore, export, sync, secret, or
  global artifact-retention behavior changed in this change. MCP projection
  cleanup is implemented in its owning active change rather than here.
- No renderer state was migrated, no canonical file schema was published, and
  no SQLite authority or rebuild behavior was changed.
- No active user data was migrated or inspected.
- No GitHub issue is locally complete based on design work alone.

## Convergence Conditions

The change remains active until implementation completes the task sequence,
all failure/restart/performance/security matrices pass, stable knowledge matches
actual paths and semantics, and the release containing the behavior is
published. Only then may related issue state move from release-pending to closed.
