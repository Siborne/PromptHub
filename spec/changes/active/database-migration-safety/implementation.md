# Data Storage And Database Migration Safety Implementation

## Status

The official-cloud M0 local storage foundation and file-first runtime authority
are implemented. Every current local durable resource has a versioned canonical
schema and production mutation path, renderer-only durable state has a canonical
owner, SQLite is a staged rebuildable catalog, managed safety points and
journaled restore are production paths, and full portable snapshots bind one
canonical checkpoint to one logical envelope. Historical, restart, low-disk,
failure-injection, browser-clear, Desktop/CLI/Web topology, fresh-reopen, and
1,000-Prompt scale evidence pass.

Desktop startup performs the one-time authority publication only after renderer
persistence migration is complete and the legacy SQLite source is available.
The former tree remains one bounded UUID checkpoint, runtime context refreshes
only after commit, and a failure retains the previous authority. The change
remains active only while final governance, coverage, release-harness,
submission, and archive convergence run; it no longer has an unimplemented
storage-authority or converter boundary.

## 2026-08-12 Authority And Evolution Completion

- Added the Desktop startup authority coordinator. Missing renderer migration
  state or a missing legacy database defers without mutation; a valid source is
  projected, rebuilt, compared, checkpointed, atomically published, reopened,
  and then installed as the process runtime context.
- Routed Prompt graph, Skill package/history, Rule history, MCP library and
  encrypted secret references, Plugin library/versions, Agent Provider Profile
  and device configuration, and Generation output mutations through canonical
  publication. SQLite remains a local query catalog and same-device operational
  store, not the sole copy of user-owned resources.
- Added immutable per-domain on-disk converter chains. Conversion preserves
  additive manifest/document fields and user revision, refuses downgrade,
  opens unknown newer resources read-only, and uses the existing durable
  resource publication journal for rollback and restart recovery.
- Made the current database manifest the single source for final table, index,
  column, destructive-migration, and legacy-migration invariants. Numeric schema
  version 3 and immutable checksums are verified before writes and after a fresh
  reopen.
- Added statement failure injection for DDL, data backfill, destructive index,
  and migration-history writes in addition to finalization and post-commit
  failures. Every case preserves the original legacy schema, `user_version = 0`,
  the old index, one safety point, and released migration leadership.
- Added capacity preflight before safety-point directory creation and a
  1,000-Prompt performance fixture. Initial canonical publication measured about
  28 seconds, one incremental Prompt mutation about 2 seconds, and canonical
  bytes about 2.9 MB; unchanged bundles and referenced objects are reused.

## 2026-08-11 M0 Convergence

- Added versioned Prompt, Skill, Rule, MCP, Plugin, Agent, and Generation
  bundles plus Folder, Tag, relation, output-format and immutable SHA-256 object
  records. Production projection reads one supplied consistent SQLite image and
  bounded managed package trees; Rule projection no longer reopens the live DB
  while maintenance is held.
- Added staged current-schema catalog reconstruction with deterministic Prompt
  graph and resource catalog hashes, `quick_check`, read-only reopen, current
  migration markers, and explicit preservation of compatibility,
  server-authoritative, and operational same-device tables. Portable trees do
  not contain those table rows or password/token values.
- Added the renderer persistence bridge and one-time migrator for settings,
  marketplace sources, device identity, recovery paths, Prompt variable cache,
  IndexedDB migration state, and encrypted credentials. Publication is atomic,
  verified before legacy redaction, and reloads after renderer storage is empty.
- Added root classification/inventory, immutable runtime context, staged
  switch/migrate/overwrite, capacity preflight, durable journals, startup
  recovery, bounded recovery artifacts, storage diagnostics, migration intent,
  client leases, post-migration verification, and Desktop-only Skill host
  reconciliation.
- Added journaled full restore, database recovery, upgrade v3 safety snapshots,
  canonical checkpoints, streaming ZIP archives, and semantic
  canonical/logical agreement. Selective exports cannot attach or leak a full
  canonical tree; a full export holds one maintenance intent from DB close
  through archive publication.
- Historical `v0.4.7`, `v0.4.8`, `v0.5.1`, and `v0.5.2` databases now pass old
  schema migration, safety-point creation, canonical projection, current catalog
  reconstruction, Prompt four-version and Skill history checks, classified
  table preservation, secret exclusion, and read-only reopen.

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
- Defined the final local durable asset topology: `data/` reconstructs all
  PromptHub-owned user assets, versions, relations, and media; configuration,
  secrets, recovery artifacts, cache, and logs retain separate owners.
- Defined independent root, domain schema, resource revision, catalog,
  portable, protocol, and encryption version axes so future asset domains do
  not require whole-root migrations.
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

## 2026-08-11 Implementation Progress

- Added a process-cached `RuntimeStorageContext` shared by runtime path getters.
  The resolver validates every inspected path component, rejects symlinks and
  special files, binds layout and root identity once, rejects markers copied
  from another root, refuses unmarked mixed canonical/legacy inventories, and
  does not let a database-only completion marker hide a failed legacy domain.
- Added atomic layout-state publication with a root-bound identity and explicit
  layout epoch. This is the compatibility primitive only; the staged root
  migration planner and diagnostics surface are still pending.
- Replaced shared database pre-migration and integrity-repair raw copies with a
  managed `VACUUM INTO` safety point. Each point contains one verified SQLite
  image, a durable manifest, SHA-256 and size checks, bounded retention, and
  symlink-safe source/output handling.
- Added database schema compatibility version `1`, a frozen checksummed baseline
  manifest entry, and committed migration history. Newer `user_version` values,
  missing history for versioned databases, unknown entries, and checksum
  mismatches fail before safety-point creation or schema writes. Direct SQLite
  entry points also reject symlinked or non-regular database paths before
  compatibility inspection.
- Moved shared table creation, imperative migrations, index creation, migration
  history, and `user_version` publication into one transaction. Previously
  swallowed migration failures now abort and roll back the transaction; failure
  injection covers finalization and host callback failures.
- Preserved the current legacy-adoption policy: existing unversioned databases
  are adopted into the version-1 baseline only after the existing migration
  sequence succeeds. The full historical artifact corpus and an immutable
  migration-per-change manifest remain pending.
- Added deterministic SQLite fixtures tied to the `v0.4.7`, `v0.4.8`, `v0.5.1`,
  and `v0.5.2` repository tags and source commits. Each fixture carries one
  four-version Prompt and Skill history through current initialization, numeric
  adoption, safety-point creation, and a second reopen without duplicate points.
- Centralized the legacy currentness marker catalog and added the previously
  omitted `agent_conversation_handoff_launch_v2` marker. A database missing that
  destructive migration marker now receives a safety point before repair.
- Replaced the adjacent raw `prompthub.db.pre-recovery-*` copy with the managed
  `pre-recovery` safety point. Recovery stops before target replacement when the
  point cannot be created; copying and publication of the incoming database and
  non-database domains remain part of the pending staged restore coordinator.
- Added the shared `prompthub-resource-bundle` manifest v1 contract in
  `packages/core`. Materialization copies regular source files in bounded
  chunks into a private stage, records deterministic per-file and aggregate
  SHA-256 values, flushes files before first publication, and cleans the stage
  on every failure. Readers preserve additive manifest fields while rejecting
  unknown manifest versions, undeclared or missing entries, duplicate and
  unsafe paths, symlinks and special files, identity mismatches, tampering, and
  configured manifest/file/count/total-byte limits. This is common bundle
  infrastructure only; no production domain or SQLite authority switched.

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
- `pnpm spec:test` passed after the earlier file/SQLite/renderer hierarchy
  update, including governance, generated change inventory, and traceability
  validation for the 22 change records present at that baseline.
- `pnpm spec:index:check` and the focused Prettier check passed after the same
  update.

## 2026-08-11 Planning Verification

- `pnpm spec:index`: passed after adding the final local asset topology and the
  official cloud/SaaS umbrella change.
- `pnpm spec:test`: passed, including governance, single-source, inventory, and
  traceability validation for 23 change records.
- Focused Prettier validation for every touched authored Markdown document:
  passed.
- `git diff --check`: passed.
- No production tests are claimed for this planning-only documentation update.

## 2026-08-11 Implementation Verification

- Follow-up storage/recovery matrix: 81 Desktop tests passed across all four
  historical database fixtures, migration safety/rollback, managed safety
  points, full data recovery, and runtime layout binding.
- Desktop storage and migration matrix: 70 tests passed across runtime paths,
  managed database safety points, migration locking/rollback, data-layout
  migration, Agent Provider Profile persistence, and Agent Session indexing.
- CLI database concurrency matrix: 21 tests passed, including overlapping real
  writers, bounded busy handling, and lease recovery.
- Self-hosted Web database bootstrap: 1 test passed for mounted-database lock
  recovery and initialization.
- `packages/db`, `packages/core`, and Desktop TypeScript checks passed with
  `tsc --noEmit`.
- Follow-up `packages/db` and `packages/core` TypeScript checks passed. A later
  Desktop-wide check was temporarily blocked by concurrent Agent activation
  edits, then passed after those parallel contracts converged.
- Spec governance, commit-rule scaffold, change inventory, single-source,
  traceability (23 changes), generated index check, focused Prettier, and
  `git diff --check` passed. The governance script used the repository-local
  Prettier binary because the installed `pnpm` launcher could not complete its
  registry signature verification.
- The focused coverage command did not instrument source files outside the
  Desktop Vitest root, so no changed-module coverage percentage is claimed.
  The full changed branch/condition coverage gate remains pending under
  `T-DATA-012` and `T-DBMIG-011`.
- Shared resource-bundle tests: 23 tests passed, including first publication,
  staging cleanup, bounded I/O, traversal/control-character rejection,
  symlink/special-file rejection, concurrent destination and source mutation,
  manifest/payload tampering, and post-inventory races. V8 reports 100% lines,
  statements, functions, and branches for `resource-bundle.ts`.
- Full `packages/core` suite after the bundle addition: 147 tests passed across
  15 files; `packages/core` and Desktop TypeScript validation passed.
- Prompt canonical graph tests: 6 focused tests passed against the real WASM
  SQLite adapter. They cover complete shadow publication, bundle reload,
  staged database reconstruction and graph-hash comparison, broken references,
  destination preservation, tampering, undeclared files, count mismatch, and
  local/server ownership separation. Prompt and Folder direct restore now
  preserve `ownerUserId`; Folder restore also preserves `visibility`, with 103
  focused Desktop database tests passing.
- Skill persistence audit found the same ownership gap one layer deeper:
  create, update, row mapping, and direct restore ignored the existing
  `owner_user_id`/`visibility` columns. All four paths now preserve those fields;
  the real SQLite source-identity suite passes 4 tests including shared/private
  ownership round trips.
- Prompt canonical source coverage is currently 90.55% statements and 71.98%
  branches across exporter, reader, and staged catalog builder. The required
  critical-boundary 100% branch/condition gate remains pending; these numbers
  are recorded rather than presented as convergence evidence.
- Content-addressed object-store tests: 7 focused tests passed with 100% line,
  statement, function, and branch coverage. They cover immutable first publish,
  deduplication, wrong hashes, source and descriptor races, source growth,
  symlink/missing/special sources, corrupt existing objects, bounded reads, and
  concurrent/error publication cleanup.
- Generation canonical schema tests: 3 focused tests passed for manifest/object
  publication and reload, missing/extra/hash-mismatched sources, unsafe output
  paths, and missing immutable objects. Full branch coverage, current-library
  shadow conversion, and SQLite generation-index reconstruction remain pending.
- Skill canonical schema tests: 3 focused tests passed for portable metadata,
  ordered version snapshots, complete package payloads, machine-local path/URL
  stripping, identity rejection, unsafe package paths, and tampering. Focused
  source coverage is 91.7% statements and 62.92% branches, so the critical
  100% branch gate and real-library shadow projector remain pending.
- Database schema v2 adds immutable migration history for `logical_name` and
  `variant_key`. The real SQLite Skill suite and all four historical database
  fixtures pass; migration lock, rollback, checksum, and safety-point coverage
  passes 23 focused tests across three files.

## 2026-08-11 M0 Verification

- `packages/core`: 36 files and 248 tests passed, including resource schemas,
  object store, renderer migration, root operations, restore journals,
  recovery registry, diagnostics, portable consistency, canonical Prompt graph,
  and complete storage shadow/catalog rebuild. Core TypeScript passed.
- Desktop main storage matrix: 20 files and 182 tests passed, including four
  tagged historical migrations, four historical canonical rebuilds, migration
  intent/rollback, safety points, root/layout migration, recovery, canonical
  projector/checkpoint/export, portable import/restore, upgrade snapshots,
  MCP secret storage, and Skill host reconciliation.
- Desktop renderer/integration storage matrix: 5 files and 49 tests passed for
  renderer persistence, backup/restore, settings snapshot, sync backup, and real
  filesystem media/package round trips. Desktop TypeScript passed.
- CLI shared-root matrix: 4 files and 55 tests passed for database contention,
  Prompt, Skill, and workspace sync behavior. Self-hosted Web topology matrix:
  7 files and 35 tests passed for runtime/database bootstrap and per-user
  Prompt, Skill, Rule, settings, and device storage.
- Historical rebuild verifies that same-device compatibility/server rows remain
  in the staged catalog while password hashes are absent from canonical files.
  The rich portable consistency fixture verifies Rule chronology normalization,
  machine-local Skill/Plugin path removal, MCP secret redaction, and Agent
  secret-ref exclusion.
- The focused suites above passed with repository-local binaries. The release
  harness and changed-branch coverage gate are recorded separately below and
  are not implied by these counts.
- After incremental publication and authority work, the complete Core suite
  passed `38` files / `269` tests. The focused Desktop authority, checkpoint,
  projector, Generation, historical rebuild, and migration-lock matrix passed
  `6` files / `51` tests. Core, DB, and Desktop TypeScript checks passed.
- `verify:release --profile quick` was attempted twice. The configured pnpm
  version switch first failed registry signature verification; bypassing the
  switch with the installed pnpm 11 then refused to purge/reinstall the existing
  pnpm 9 `node_modules` without a TTY. The harness therefore did not reach its
  checks. Dependencies were not modified; equivalent focused local binaries and
  spec governance checks above remain the current evidence.

## 2026-08-12 Final Storage Verification

- Complete Core suite and V8 instrumentation: 48 files and 292 tests passed.
  The 1,000-Prompt fixture measured 27.9 seconds for initial publication,
  2.1 seconds for one incremental mutation, 50,288 KiB maximum RSS increase,
  and 2,861,387 canonical bytes. Resource bundle and content-addressed object
  store remain at 100% line/function/branch coverage; the combined Core report
  is 48.3% statements and 78.88% branches because it instruments unrelated
  untested CLI and legacy modules too. Several new storage orchestrators remain
  below 100% whole-file branch coverage, so `T-DATA-012` stays open rather than
  converting focused adversarial evidence into a false coverage claim.
- Database migration TypeScript passed. The migration lock suite passed 22 tests,
  including immutable manifest identity, numeric/current invariants, destructive
  classification, safety-point gating, finalization rollback, and injected DDL,
  data, destructive-index, history, and post-commit failures.
- The accumulated focused Desktop storage matrix passed 24 files and 240 tests;
  its renderer/jsdom subset passed 3 files and 7 tests from the Desktop root.
  CLI passed 14 files and 123 tests; self-hosted Web storage topology passed 16
  files and 89 tests. Core, DB, Shared, CLI, Desktop, Web, Worker, and Mobile
  TypeScript checks passed in the release harness.
- The quick release harness ran all 22 configured checks after disabling pnpm
  11's automatic dependency reinstall. Core, CLI, Web, Worker, Mobile, Shared,
  DB, lint, and typecheck checks passed. The Desktop full unit surface failed on
  unrelated concurrent Agent changes and sandbox-denied local listeners; the
  file-size gate also reports an unrelated 1,575-line Agent workbench test. The
  initially stale spec index was regenerated and `pnpm spec:test` then passed
  all governance and 23-change traceability checks. The full release harness was
  not run because the quick profile has unresolved non-storage failures.
- Focused Prettier and `git diff --check` passed. No dependency tree, user data,
  network configuration, or long-running process was changed or retained.

## Known Current Production Risks

- Publication is bounded by explicit inventory, file-size, total-byte, RSS, and
  timeout guards, but the catalog projector still holds bounded metadata arrays
  in memory rather than using an external sort. The 1,000-Prompt fixture is the
  current measured capacity baseline; materially larger supported limits require
  another benchmark before raising configured bounds.
- Unknown newer domain schemas are intentionally not writable. They remain
  readable only where the domain reader can preserve them without mutation;
  otherwise startup or mutation fails closed until a newer client is installed.
- Critical boundaries have adversarial focused suites. Final combined coverage
  and release harness results are recorded during submission convergence rather
  than inferred from individual passing suites.

## Remaining Work

- Raise the remaining changed-orchestrator coverage recorded by `T-DATA-012`
  and rerun the full release harness after the unrelated Desktop/Agent failures
  in the quick profile are resolved.
- Complete submission traceability, archive this change after convergence, and
  keep related GitHub issues open until the containing version is published.

## File Size Decisions

- `portable-snapshot-restore.ts` is 1,004 lines and
  `renderer-persistence-migration.ts` is 1,090 lines. They remain single
  orchestration modules for this change because splitting their transaction and
  resume state machines would distribute invariants across files without
  removing complexity. Boundary helpers are already separated, and focused
  failure/resume tests cover the retained orchestration surfaces. Neither file
  crosses the mandatory 2,000-line limit; follow-up extraction should be driven
  by a new independent responsibility rather than line count alone.

## Convergence Conditions

M0 local storage foundation, file-first runtime authority, converter chain, and
measured local scale baseline are converged and can be consumed by separately
scoped official backup work. This change remains active only for final automated
gates and submission. After those pass it moves to the dated archive; related
GitHub issues remain open until the containing release is published.
