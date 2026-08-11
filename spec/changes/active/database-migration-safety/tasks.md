# Data Storage And Database Migration Safety Tasks

## Analyze And Decisions

- [x] `T-DATA-001` Inventory runtime paths, root selection, data-root migration,
      layout migration, upgrade/recovery snapshots, portable export/restore,
      WebDAV/S3 sync, MCP projection backups, Agent config backups, secrets, and
      product-specific storage topologies.
- [x] `T-DATA-002` Confirm `COMPAT-DATA-001` through `COMPAT-DATA-003` and
      publish the typed storage catalog with owner, path, safety-point,
      portable, retention, and recovery policy for every current durable class.
- [x] `T-DBMIG-001` Inventory Desktop, CLI, Web, shared SQLite, data-layout,
      updater snapshot, integrity repair, and legacy IndexedDB migration paths.
- [x] `T-DBMIG-002` Build real SQLite fixtures for empty, current, every supported
      legacy baseline, partial currentness, corrupt, checksum mismatch, and newer
      compatibility versions. Record exact supported minimum/maximum versions.
  - Completed: deterministic SQLite fixtures anchored to repository tags
    `v0.4.7`, `v0.4.8`, `v0.5.1`, and `v0.5.2` preserve a four-version Prompt,
    Skill history, and committed version/checksum state through current
    initialization, canonical projection, current-schema catalog rebuild, and a
    second reopen. Empty/current, missing-marker partial state, unsupported
    corruption, checksum mismatch, and newer numeric schema cases are covered;
    the supported tagged compatibility range is `v0.4.7` through `v0.5.2`.

## Phase 1: Resolve Root And Database Compatibility

- [x] `T-DATA-003` Add a process-immutable local `RuntimeStorageContext`,
      root/layout preflight, atomic boot-pointer writer, canonical layout-state
      marker, and diagnostics. Remove per-getter switching only after all callers
      and compatibility fixtures pass.
  - Completed: immutable shared context, root-bound layout state, boot-pointer
    publication through the root coordinator, symlink/special-path rejection,
    fail-closed mixed-layout detection, caller fixtures, startup recovery, and
    read-only diagnostics.
- [x] `T-DBMIG-003` Add immutable migration types/manifest, numeric compatibility
      gate, committed checksummed history, legacy adoption path, and manifest
      consistency tests.
  - Completed: numeric catalog version 3, immutable ordered manifest entries,
    committed checksummed history, destructive classification, and one derived
    invariant/legacy-migration catalog now drive planning and post-checks. Four
    tagged historical baselines, future-version rejection, checksum tampering,
    partial currentness, catalog rebuild, and second-reopen fixtures pass.
- [x] `T-DBMIG-004` Implement the atomic runner and migrate imperative branches
      incrementally. Inject failure at every changed decision/statement and prove
      DDL, data, history, and `user_version` roll back together.
  - Completed: shared schema, legacy migrations, indexes, history, and
    `user_version` commit in one transaction. Failure injection at representative
    DDL, data backfill, destructive index, history, finalization, and post-commit
    boundaries proves rollback, retained safety points, and released leadership.
- [x] `T-DBMIG-005` Move `local_repo_path` discovery into an idempotent Desktop
      reconciliation service and cover CLI-first/Web-first ordering.

## Phase 1A: Transition Local Persistence Authority

- [x] `T-DATA-015` Define and fixture versioned canonical file bundles/manifests
      for every local durable domain. Close Prompt workspace gaps for relations,
      output-format links, versions, media references, and PromptHub-owned Agent
      metadata before changing authority.
  - Implemented slice: shared `prompthub-resource-bundle` manifest v1 parsing,
    deterministic content hashing, bounded streaming materialization, strict
    declared-file verification, unknown additive field preservation, and
    atomic first publication now live in `packages/core`. Prompt v1 now covers
    complete Prompt/version documents, stable Tag references, legacy image and
    video references, Folder records, graph relations, and output-format items.
    A real-SQLite shadow exporter publishes a hashed canonical graph and its
    reader rejects missing, undeclared, unsafe, or tampered records. Skill,
    Rule, MCP, Plugin, Agent, and Generation schemas are registered and emitted
    by the production projector. A streaming content-addressed object store
    publishes immutable SHA-256 objects at
    `data/assets/objects/sha256/<prefix>/<hash>`, deduplicates identical bytes,
    detects source mutation and corrupt existing objects, and rejects symlink,
    size-limit, and publication-race failures. Prompt, Generation, Skill, and
    Plugin package projectors publish object identities while preserving the
    legacy logical reference needed during the authority transition.
  - Implemented slice: generation schema v1 wraps the existing batch manifest,
    requires slot/count/output invariants, publishes every successful output to
    the immutable object store, and verifies bundle/object identity on reload.
    Production generation shadow conversion and catalog index rebuild are
    implemented and covered by the production projector tests.
  - Implemented slice: Skill schema v1 now carries portable complete metadata,
    ordered version snapshots, and managed package files while deriving rather
    than serializing `local_repo_path`. The SQLite catalog moved to numeric
    schema v2 to preserve `logical_name` and `variant_key`, fields already used
    by Skill package identity but previously absent from storage.
  - Implemented slice: durable per-resource publication journals now stage,
    verify, replace, roll back, and restart-recover bundle mutations. Skill,
    Rule, MCP, Plugin, Agent, and Generation writers allocate resource revisions
    independently from domain-history/schema versions. Recovery inventories all
    journals before mutation so an exceeded bound cannot partially recover a
    root. The Prompt graph catalog owns only Prompt graph records and referenced
    Prompt objects; independently verified domain bundles no longer force a
    whole-root catalog rewrite.
- [x] `T-DATA-016` Add the one-time renderer persistence migrator. Move validated
      settings, marketplace sources, device identities, recovery metadata, and
      any declared durable Prompt variable history to canonical owners; extract
      credentials into the device-bound secret store; verify restart and
      browser-clear safety before redacting legacy copies.
- [x] `T-DATA-017` Add a staged, bounded local SQLite rebuild from canonical
      files, shadow-compare stable IDs/counts/hashes/relations/versions, publish
      atomically, and retain the prior database as one bounded safety point.
      Classify operational and server-authoritative tables explicitly.
  - Implemented slice: the Prompt canonical graph stages a fresh current-schema
    SQLite image, reloads it read-only, runs `quick_check`, and compares a
    deterministic graph hash covering IDs, fields, versions, Folder hierarchy,
    relations, output formats, and media references before first publication.
    Local rebuild rejects server-owned user references. Skill, Rule, Agent,
    Generation and canonical-resource indexes rebuild from files; explicitly
    classified compatibility, server-authoritative, and operational rows are
    copied only from the same-device source. Historical fixtures and a fresh
    read-only reopen verify the result. The file-authority marker and whole-data
    publication coordinator now stage the canonical tree plus relocated catalog
    paths, reuse one maintenance barrier, preserve the prior `data/` tree as one
    recovery artifact, and roll back post-publication verification failures.
    objects inside the SQLite transaction while keeping display copies in
    disposable cache. Prompt, Skill, Rule, MCP, Plugin, and Agent production
    mutations now maintain canonical resources too. Desktop startup publishes
    the verified authority only after renderer migration, retains the former
    tree as one UUID safety point, and refreshes runtime context only after
    commit. A 1,000-Prompt inventory verifies bounded publication and
    copy-on-write incremental reuse.
- [x] `T-DATA-018` Implement the independent resource-schema registry and
      immutable converter chain. Cover additive unknown-field preservation,
      supported old schemas, unknown newer read-only/fail-closed behavior,
      future-domain registration, interrupted conversion, and downgrade.
  - Completed: independent immutable domain registration, ordered on-disk
    converter chains, additive unknown-field preservation, independent user
    revision, atomic journaled publication, restart recovery, downgrade refusal,
    and unknown-newer read-only behavior are covered by fixtures.

## Phase 2: Safe Root Migration And Safety Points

- [x] `T-DATA-004` Replace broad marker detection with source/target
      classification, bounded inventory, ownership rules, symlink/special-file
      rejection, and accurate canonical database summaries.
- [x] `T-DATA-005` Implement the staged `switch`/`migrate`/`overwrite` planner,
      maintenance barrier, capacity check, target staging, hash/SQLite
      verification, atomic publish, crash journal, and cleanup. Keep source data
      unchanged until publication.
- [x] `T-DATA-006` Implement one allowlisted managed safety-point service using a
      proven SQLite-consistent primitive, stable run identity, secret policy,
      manifest, and count/age/byte retention. Migrate upgrade/layout/integrity
      callers only after parity and recovery tests pass.
  - Completed: managed database safety points with verified
    manifests, SHA-256/size checks, count/age/byte retention, and symlink-safe
    boundaries; shared migration/integrity callers and the current-database
    backup before recovery use the service. Recovery refuses overwrite when the
    safety point cannot publish. Upgrade v3 snapshots add the bounded
    non-database allowlist and secret policy; install/startup reuse stable run
    identity and mutation callers fail closed when protection cannot publish.
- [x] `T-DBMIG-006` Capability-test `VACUUM INTO` with the real WASM adapter and
      integrate the accepted database image primitive with migration planning.
  - Completed: real-adapter tests prove `VACUUM INTO` creates one
    quick-check-clean image while the WAL source connection remains open and
    excludes writes committed after snapshot creation. Migration, integrity,
    recovery, and upgrade paths use the accepted image/snapshot primitives.
- [x] `T-DBMIG-007` Add path-scoped migration intent and finite leadership
      acquisition integrated with current client leases and typed busy errors.
- [x] `T-DBMIG-008` Add post-migration quick-check, history/checksum/schema/domain
      verification, fresh-reopen verification, and staged recovery tests.

## Phase 3: Restore, Export, And Artifact Lifecycle

- [x] `T-DATA-007` Move full restore to main/Core orchestration with complete
      preflight, staged DB/files/domain state, durable publication journal,
      restart resolution, and no best-effort partial-success result.
- [x] `T-DATA-008` Add a consistent portable snapshot coordinator and versioned
      envelope. Read selected scopes only and stream files/compression with
      bounded memory, concurrency, traversal, and retry.
- [x] `T-DATA-009` Preserve self-hosted Web multi-user isolation while aligning
      logical snapshot/domain contracts; add Desktop/CLI/Web topology fixtures.
- [x] `T-DATA-010` Add the bounded recovery-artifact registry and coordinate
      removal/migration of MCP sidecars, Agent config trees, raw database
      siblings, and duplicate upgrade artifacts with their owning changes.
- [x] `T-DATA-011` Add a read-only storage diagnostic surface that reports the
      real root, layout epoch, database path/version, journal stage, recovery
      types, and omissions without exposing credentials.

## Phase 4: Desktop Upgrade And Historical Evidence

- [x] `T-DBMIG-009` Coordinate updater/startup safety point, data-layout stage,
      shared SQLite migration, Desktop reconciliation, and legacy IndexedDB
      import. Preserve independently retryable stage records without duplicate
      safety points.
- [x] `T-DBMIG-010` Reuse the tagged #89/#97/#98 corpus from
      `legacy-upgrade-recovery-audit`; add large/low-disk stress cases and measure
      time, peak memory, temporary disk, and cleanup after failure.
  - Completed: four tagged historical databases survive migration and canonical
    rebuild; explicit capacity preflight fails before backup-directory creation;
    cleanup and rollback failures retain no partial publication. A 1,000-Prompt
    run measured about 28 seconds initial publication, about 2 seconds for one
    incremental mutation, roughly 2.9 MB canonical data, and bounded RSS below
    the 512 MiB guard on the development machine.

## Verification And Convergence

- [ ] `T-DATA-012` Run root, layout, safety-point, restore, export/sync,
      artifact-retention, product-topology, security, and performance matrices;
      require 100% changed branch/condition coverage at critical boundaries.
- [ ] `T-DBMIG-011` Run focused package tests, Desktop/CLI/Web integration tests,
      coverage gates, `pnpm verify:release:quick`, and the full release harness
      when packaging risk changes.
- [x] `T-DATA-013` After implementation verification, update stable data-layout,
      recovery, sync, security, and operations docs with actual file names,
      topology, upgrade/rollback steps, and retained compatibility limits.
- [x] `T-DBMIG-012` Update stable database concurrency, contributor migration
      procedure, issue overlay, and release notes only after behavior verifies.
- [ ] `T-DATA-014` Complete `implementation.md`, run converge analysis, archive
      the change, and leave GitHub issues open until the containing release is
      publicly available.

## Required Execution Order

1. Land historical fixture baselines for the confirmed compatibility policies.
2. Define complete canonical file schemas and renderer-state migration without
   changing the active source of truth.
3. Establish immutable root/layout and database compatibility gates.
4. Establish one safety-point primitive before replacing backup callers.
5. Shadow-rebuild and compare SQLite before publishing file-first authority.
6. Make root migration and restore staged before removing legacy fallbacks.
7. Make portable export bounded/consistent before attaching new transports.
8. Remove legacy artifact producers only after equivalent recovery evidence.
9. Converge stable docs only after production behavior and restart tests agree.
