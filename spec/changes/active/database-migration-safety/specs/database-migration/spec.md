# Database Migration Safety Delta Specification

## Added Requirements

### `FR-DBMIG-001`: Explicit Ordered Compatibility

The Desktop, CLI, and self-hosted Web products must use one ordered migration
manifest for the shared SQLite database. The database must expose a numeric
compatibility version and immutable committed migration identities. A binary
must reject a database whose compatibility version is newer than it supports.

#### Scenario: Older binary opens a newer database

Given a database version above the binary's supported maximum, initialization
fails before schema, history, marker, backup, or business data is modified. The
error identifies the unsupported version and directs the user to a compatible
PromptHub version or read-only recovery flow.

### `FR-DBMIG-002`: Atomic Migration Execution

Every applicable shared SQLite migration must either commit its schema changes,
data changes, verification result, history row, and compatibility version
together, or leave all of them unchanged. A migration callback may not convert
an error into a successful early return.

#### Scenario: A data transform fails after earlier DDL

Given an injected failure after an earlier statement changed the schema, the
transaction rolls back, the migration is not recorded, the compatibility
version does not advance, later migrations do not run, and restart retries from
the same pre-migration state.

### `FR-DBMIG-003`: One Authoritative Migration Manifest

Backup eligibility, currentness, execution order, verification, and history must
derive from the same manifest. Adding a migration must not require updating a
second manual list of required tables, columns, or names to obtain safety.

#### Scenario: A destructive migration is registered

When a migration declares that it rebuilds or drops durable structures, the
planner automatically requires a safety point. Tests fail if the migration is
not represented in the ordered manifest or its verification contract.

### `FR-DBMIG-004`: Host-Neutral Schema Migrations

Shared schema history may contain only deterministic database work. Filesystem
discovery and host-specific path reconciliation must use a separate idempotent
stage and must not be marked complete by a host that could not execute it.

#### Scenario: CLI initializes before Desktop

When CLI initializes a database containing Skills without local repository
paths, CLI completes shared schema migration without marking Desktop repository
reconciliation complete. A later Desktop start runs reconciliation and records
its own verified result.

### `FR-DBMIG-005`: Single Managed Safety Point

An upgrade or migration run that can change durable data must create at most one
managed safety point before its first destructive write. The safety point must
contain a SQLite-consistent database image, a manifest with run/reason/from/to
versions, and the required non-database durable files. It must obey bounded
retention and must not leave timestamped copies beside the live database.

#### Scenario: Updater and next startup cover the same upgrade

When installation creates a safety point and the target version later starts,
startup reuses the same verified upgrade identity rather than creating a second
snapshot. A failed or incomplete safety point is never treated as reusable.

### `FR-DBMIG-006`: Serialized Migration Leadership

Only one process may plan, snapshot, or execute a migration for a database path.
Leadership acquisition must respect live/unknown clients, use a finite wait, and
fail closed without deleting another process's lock or lease.

#### Scenario: Desktop is open when CLI requires a migration

CLI returns an actionable migration-busy result after the bounded wait. It does
not create a safety point, change schema, delete locks, or partially register a
migration.

### `FR-DBMIG-007`: Verified Publication And Recovery

Initialization may expose the database to application services only after
SQLite integrity, manifest history, expected schema, and changed domain
invariants pass. Failure preserves the safety point and emits a recovery
candidate; automatic repair remains limited to the stable allowlist.

#### Scenario: Post-migration verification fails

When the transaction succeeds but a required domain invariant fails before
publication, startup does not report success. The failed database is retained
for diagnosis, the active state is restored or recoverable from the managed
safety point, and restart does not skip the failed migration.

### `FR-DBMIG-008`: Explicit Multi-Stage Desktop Upgrade

Desktop must represent data-root selection, safety-point creation, filesystem
layout migration, shared SQLite migration, host reconciliation, and legacy
IndexedDB import as distinct ordered stages with idempotent completion records.
A stage marker is written only after its durable outputs verify.

#### Scenario: Layout migration succeeds and IndexedDB import fails

Restart recognizes the verified layout and SQLite stages, retries only the
IndexedDB import, and does not duplicate imported Prompt versions or create a
new safety point for the same run.

### `FR-DBMIG-009`: Historical And Adversarial Evidence

The migration harness must cover sanitized v0.4.7, v0.4.8, v0.5.1, and v0.5.2
fixtures plus fresh, current, partial, corrupt, busy, newer-schema, large, and
cross-host-order cases. Verification must compare durable rows and restart
behavior, not only migration names or row counts.

#### Scenario: Four-version Prompt crosses a legacy migration

The oldest, every intermediate, and latest Prompt version retain identity,
content, order, metadata, and rollback behavior through migration and restart.

## Non-Functional Requirements

- `NFR-DBMIG-001`: Planning is `O(M)` in registered migrations; each data
  transform is no worse than `O(N log N)` without a documented measured reason.
- `NFR-DBMIG-002`: Safety-point work is `O(B)` time and disk with bounded memory.
- `NFR-DBMIG-003`: All waits, retries, scans, and concurrency are finite.
- `NFR-DBMIG-004`: New and changed critical branches require 100% branch and
  condition coverage plus real rollback, corruption, concurrency, and capacity
  tests.
