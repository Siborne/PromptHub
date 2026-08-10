# Data Storage And Database Migration Safety Tasks

## Analyze And Decisions

- [x] `T-DATA-001` Inventory runtime paths, root selection, data-root migration,
      layout migration, upgrade/recovery snapshots, portable export/restore,
      WebDAV/S3 sync, MCP projection backups, Agent config backups, secrets, and
      product-specific storage topologies.
- [ ] `T-DATA-002` Confirm the remaining `COMPAT-DATA-001` and
      `COMPAT-DATA-002`; `COMPAT-DATA-003` was confirmed on 2026-08-10. Then
      publish
      the typed storage catalog with owner, path, safety-point, portable,
      retention, and recovery policy for every current durable class.
- [x] `T-DBMIG-001` Inventory Desktop, CLI, Web, shared SQLite, data-layout,
      updater snapshot, integrity repair, and legacy IndexedDB migration paths.
- [ ] `T-DBMIG-002` Build real SQLite fixtures for empty, current, every supported
      legacy baseline, partial currentness, corrupt, checksum mismatch, and newer
      compatibility versions. Record exact supported minimum/maximum versions.

## Phase 1: Resolve Root And Database Compatibility

- [ ] `T-DATA-003` Add a process-immutable local `RuntimeStorageContext`,
      root/layout preflight, atomic boot-pointer writer, canonical layout-state
      marker, and diagnostics. Remove per-getter switching only after all callers
      and compatibility fixtures pass.
- [ ] `T-DBMIG-003` Add immutable migration types/manifest, numeric compatibility
      gate, committed checksummed history, legacy adoption path, and manifest
      consistency tests.
- [ ] `T-DBMIG-004` Implement the atomic runner and migrate imperative branches
      incrementally. Inject failure at every changed decision/statement and prove
      DDL, data, history, and `user_version` roll back together.
- [ ] `T-DBMIG-005` Move `local_repo_path` discovery into an idempotent Desktop
      reconciliation service and cover CLI-first/Web-first ordering.

## Phase 1A: Transition Local Persistence Authority

- [ ] `T-DATA-015` Define and fixture versioned canonical file bundles/manifests
      for every local durable domain. Close Prompt workspace gaps for relations,
      output-format links, versions, media references, and PromptHub-owned Agent
      metadata before changing authority.
- [ ] `T-DATA-016` Add the one-time renderer persistence migrator. Move validated
      settings, marketplace sources, device identities, recovery metadata, and
      any declared durable Prompt variable history to canonical owners; extract
      credentials into the device-bound secret store; verify restart and
      browser-clear safety before redacting legacy copies.
- [ ] `T-DATA-017` Add a staged, bounded local SQLite rebuild from canonical
      files, shadow-compare stable IDs/counts/hashes/relations/versions, publish
      atomically, and retain the prior database as one bounded safety point.
      Classify operational and server-authoritative tables explicitly.

## Phase 2: Safe Root Migration And Safety Points

- [ ] `T-DATA-004` Replace broad marker detection with source/target
      classification, bounded inventory, ownership rules, symlink/special-file
      rejection, and accurate canonical database summaries.
- [ ] `T-DATA-005` Implement the staged `switch`/`migrate`/`overwrite` planner,
      maintenance barrier, capacity check, target staging, hash/SQLite
      verification, atomic publish, crash journal, and cleanup. Keep source data
      unchanged until publication.
- [ ] `T-DATA-006` Implement one allowlisted managed safety-point service using a
      proven SQLite-consistent primitive, stable run identity, secret policy,
      manifest, and count/age/byte retention. Migrate upgrade/layout/integrity
      callers only after parity and recovery tests pass.
- [ ] `T-DBMIG-006` Capability-test `VACUUM INTO` with the real WASM adapter and
      integrate the accepted database image primitive with migration planning.
- [ ] `T-DBMIG-007` Add path-scoped migration intent and finite leadership
      acquisition integrated with current client leases and typed busy errors.
- [ ] `T-DBMIG-008` Add post-migration quick-check, history/checksum/schema/domain
      verification, fresh-reopen verification, and staged recovery tests.

## Phase 3: Restore, Export, And Artifact Lifecycle

- [ ] `T-DATA-007` Move full restore to main/Core orchestration with complete
      preflight, staged DB/files/domain state, durable publication journal,
      restart resolution, and no best-effort partial-success result.
- [ ] `T-DATA-008` Add a consistent portable snapshot coordinator and versioned
      envelope. Read selected scopes only and stream files/compression with
      bounded memory, concurrency, traversal, and retry.
- [ ] `T-DATA-009` Preserve self-hosted Web multi-user isolation while aligning
      logical snapshot/domain contracts; add Desktop/CLI/Web topology fixtures.
- [ ] `T-DATA-010` Add the bounded recovery-artifact registry and coordinate
      removal/migration of MCP sidecars, Agent config trees, raw database
      siblings, and duplicate upgrade artifacts with their owning changes.
- [ ] `T-DATA-011` Add a read-only storage diagnostic surface that reports the
      real root, layout epoch, database path/version, journal stage, recovery
      types, and omissions without exposing credentials.

## Phase 4: Desktop Upgrade And Historical Evidence

- [ ] `T-DBMIG-009` Coordinate updater/startup safety point, data-layout stage,
      shared SQLite migration, Desktop reconciliation, and legacy IndexedDB
      import. Preserve independently retryable stage records without duplicate
      safety points.
- [ ] `T-DBMIG-010` Reuse the tagged #89/#97/#98 corpus from
      `legacy-upgrade-recovery-audit`; add large/low-disk stress cases and measure
      time, peak memory, temporary disk, and cleanup after failure.

## Verification And Convergence

- [ ] `T-DATA-012` Run root, layout, safety-point, restore, export/sync,
      artifact-retention, product-topology, security, and performance matrices;
      require 100% changed branch/condition coverage at critical boundaries.
- [ ] `T-DBMIG-011` Run focused package tests, Desktop/CLI/Web integration tests,
      coverage gates, `pnpm verify:release:quick`, and the full release harness
      when packaging risk changes.
- [ ] `T-DATA-013` After implementation verification, update stable data-layout,
      recovery, sync, security, and operations docs with actual file names,
      topology, upgrade/rollback steps, and retained compatibility limits.
- [ ] `T-DBMIG-012` Update stable database concurrency, contributor migration
      procedure, issue overlay, and release notes only after behavior verifies.
- [ ] `T-DATA-014` Complete `implementation.md`, run converge analysis, archive
      the change, and leave GitHub issues open until the containing release is
      publicly available.

## Required Execution Order

1. Confirm the two remaining compatibility decisions and land fixture baselines.
2. Define complete canonical file schemas and renderer-state migration without
   changing the active source of truth.
3. Establish immutable root/layout and database compatibility gates.
4. Establish one safety-point primitive before replacing backup callers.
5. Shadow-rebuild and compare SQLite before publishing file-first authority.
6. Make root migration and restore staged before removing legacy fallbacks.
7. Make portable export bounded/consistent before attaching new transports.
8. Remove legacy artifact producers only after equivalent recovery evidence.
9. Converge stable docs only after production behavior and restart tests agree.
