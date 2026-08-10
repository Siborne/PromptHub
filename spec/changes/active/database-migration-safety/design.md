# Data Storage And Database Migration Safety Design

## Design Objective

The target is one publishable storage state, not one giant storage module.
Domain owners keep their own models, while a shared storage boundary decides
where durable state lives, how a process selects it, and how mutations become
visible atomically. For local roots, the recommended hierarchy is canonical
versioned files, a rebuildable SQLite catalog/index plus classified operational
tables, and disposable renderer cache/session state. Database migration is one
stage in that broader boundary.

## Current Storage Audit

| Finding          | Current evidence                                                                                                                                  | Consequence                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `AUDIT-DATA-001` | Core runtime getters independently prefer canonical paths and fall back to legacy paths.                                                          | One process can combine a canonical database with legacy Skills, Prompts, images, or videos.                 |
| `AUDIT-DATA-002` | Desktop duplicates Core runtime-path logic; self-hosted Web implements a separate multi-user layout while comments imply alignment.               | Path behavior can drift and documentation cannot identify one physical topology accurately.                  |
| `AUDIT-DATA-003` | A data root is considered PromptHub data when any broad marker exists, including empty `data`, `config`, `backups`, or `logs` directories.        | Switch/overwrite can accept an unrelated directory as an owned PromptHub root.                               |
| `AUDIT-DATA-004` | The boot pointer is written directly and data-root migration copies top-level items into the target without a complete staged publish.            | A crash or copy error can leave an ambiguous target and a pointer whose durability is not proven.            |
| `AUDIT-DATA-005` | Upgrade backup copies most of the user-data tree, including browser/runtime and configuration state, using file copies.                           | Safety points include non-durable or sensitive state and do not prove a consistent SQLite image.             |
| `AUDIT-DATA-006` | Upgrade restore removes/replaces top-level entries sequentially; database recovery copies the database first and merges files afterward.          | A later failure can expose a database/filesystem combination that never existed as one committed state.      |
| `AUDIT-DATA-007` | Portable export aggregates records and media across multiple APIs and creates ZIP bytes in memory; selective exports begin from a broad snapshot. | Export is not point-in-time consistent and can consume memory/I/O proportional to the full library.          |
| `AUDIT-DATA-008` | Renderer restore continues after domain failures and deletes current Skills before recreating them.                                               | Restore can finish with partial durable mutation and report a list of errors rather than roll back.          |
| `AUDIT-DATA-009` | MCP projections create adjacent timestamped sidecars; Agent configuration writes use separate timestamped backup trees.                           | Rollback material is mistaken for version history and grows without one retention policy.                    |
| `AUDIT-DATA-010` | Stable data-layout docs name planned config/media paths that differ from current `ai-models.json`, settings, secrets, and generations.            | Operators cannot determine the actual source of truth or safe backup scope from documentation.               |
| `AUDIT-DATA-011` | Data-path summary checks only a root-level database while canonical runtime resolution prefers `data/prompthub.db`.                               | A valid canonical root can be shown as unavailable or empty.                                                 |
| `AUDIT-DATA-012` | Plaintext AI provider keys may live in `config/ai-models.json`, while Agent secrets use separate device files.                                    | Including all config in portable backup can leak credentials; excluding all config loses valid settings.     |
| `AUDIT-DATA-013` | `prompthub-settings` persists renderer settings while main also stores settings in SQLite and AI configuration in `config/ai-models.json`.        | Rehydration and writes have multiple directions; there is no single settings authority or atomic commit.     |
| `AUDIT-DATA-014` | Renderer storage owns credentials, sync configuration, custom store sources, device identities, Prompt variable history, and recovery paths.      | Clearing browser data can lose product state, and raw browser-directory backup can retain plaintext secrets. |
| `AUDIT-DATA-015` | Prompt workspace import resets DB-only fields and omits Prompt relations/output-format links; newer multi-message state is designed for SQLite.   | Prompt files are an incomplete projection and cannot currently rebuild the local database without loss.      |

## `DES-DATA-001`: Storage Catalog And Ownership

One typed catalog is the review and runtime source for storage classes. It does
not enumerate every user file eagerly; it defines the root helper, owner, and
lifecycle policy for each class.

| Class                              | Examples                                                                      | Source of truth                                    | Same-device safety point           | Portable snapshot              | Retention                   |
| ---------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------- | ------------------------------ | --------------------------- |
| Canonical local domain files       | Prompt bundles, Skills, Rules, MCP/Plugin libraries, generations, media       | Versioned files under `data/`                      | Required                           | Scope-dependent                | Product data lifetime       |
| Rebuildable local catalog/index    | FTS, list/search catalogs, file-derived relations, generation/session indexes | SQLite projection from canonical files             | Optional optimization              | Excluded or logical projection | Rebuildable                 |
| Local operational relational state | migration history, journals, locks, leases, incomplete operation state        | SQLite or atomic operation manifests               | Required when recovery-relevant    | Excluded                       | Bounded operational policy  |
| Server relational authority        | users, refresh tokens, server tenancy, remote service state                   | Server SQLite/D1/remote database                   | Server policy                      | Explicit logical export only   | Server policy               |
| Derived external projection        | Agent target configs produced from managed assets                             | Owning canonical domain file                       | Rebuild, not duplicated as history | Excluded or re-derived         | Rebuildable                 |
| Domain version history             | Prompt/Skill/Rule/MCP/Plugin versions                                         | Versioned canonical domain files                   | Included with domain               | Included with selected domain  | Domain policy               |
| Device configuration               | non-secret settings, endpoints, marketplace sources, device identity          | Versioned `config/` files or classified main state | Allowlisted                        | Optional/redacted              | Current plus domain history |
| Secret                             | credentials and tokens                                                        | encrypted secret store or OS facility              | Device-bound ciphertext only       | Excluded by default            | Credential lifecycle        |
| Ephemeral rollback                 | temporary previous file during atomic projection                              | Operation staging                                  | Not retained after verification    | Excluded                       | Operation lifetime          |
| Managed safety point               | pre-upgrade/pre-migration committed state                                     | `backups/safety-points/`                           | Self                               | Excluded from other snapshots  | Bounded count/age/bytes     |
| Portable snapshot                  | export/WebDAV/S3/Git transport payload                                        | Explicit artifact                                  | Not recursively included           | Self                           | User/transport policy       |
| Recovery candidate                 | legacy database, failed publication, insurance set                            | `backups/recovery/` metadata plus immutable source | Read-only                          | Excluded                       | Bounded/manual decision     |
| Cache/log/renderer runtime         | UI preferences, quota/catalog cache, logs, session markers                    | Rebuildable/runtime                                | Excluded                           | Excluded                       | Bounded operational policy  |

New persistent state must enter this catalog before implementation. Runtime
helpers derive paths from it; public UI names use the semantic class rather than
the generic word "backup".

## `DES-DATA-002`: Root And Layout Resolution

Desktop boot resolves an immutable `RuntimeStorageContext` before opening
SQLite. CLI uses the same local resolver. The context contains:

```text
activeRoot
rootIdentity
layoutEpoch
databasePath
dataPath
configPath
backupPath
cachePath
logsPath
resolutionReason
```

All domain getters accept or read this resolved context. They do not check the
filesystem again and independently switch to a legacy path. The external boot
pointer remains below the platform application-data location so PromptHub can
find a custom root before binding it. Pointer writes use a temporary file,
flush, atomic rename, and parent-directory flush where supported.

The selected root stores `data/.layout-state.json` with a format version,
root identity, completion state, and last verified operation. The marker is
published only after the complete layout verifies. A mixed root is a repair or
migration input, not a valid layout epoch.

Compatibility recommendation `COMPAT-DATA-001` preserves legacy readability by
choosing the entire recognized legacy epoch during preflight. It does not remove
the promised v0.7 read window; it removes unsafe per-domain mixing during that
window.

## `DES-DATA-003`: Product Topology

| Product           | Physical topology                                                                                                  | Shared boundary                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Desktop           | one selected local root per installation/profile                                                                   | storage context, SQLite manifest, portable envelope         |
| CLI               | same selected local root when acting on Desktop data; explicit `--data-dir` creates another complete root identity | storage context, SQLite manifest                            |
| Self-hosted Web   | server-controlled root with isolated user subtrees and one server database policy                                  | logical domain IDs and portable envelope, not Desktop paths |
| Expo mobile       | app sandbox and independent SQLite manifest                                                                        | portable/sync contract only                                 |
| Cloudflare Worker | D1/R2/KV deployment storage                                                                                        | remote protocol and envelope only                           |

The Core path module owns shared local contracts. Desktop adds only native root
selection and installation policy. Web keeps a dedicated physical resolver and
must not claim byte-for-byte Desktop layout alignment.

## `DES-DATA-004`: Root Change State Machine

`switch`, `migrate`, and `overwrite` share one planner but have different
preconditions:

- `switch`: target must already be a verified complete PromptHub root.
- `migrate`: target must be absent/empty; source remains authoritative until
  staged publication succeeds.
- `overwrite`: target must be a recognized PromptHub root. Unknown non-empty
  directories are never adopted or cleared.

The operation is:

```text
discover and classify source/target
  -> acquire root/database leadership and enter maintenance mode
  -> inventory durable allowlist and verify capacity
  -> create/reuse one safety point when destructive
  -> stage target on the target filesystem
  -> migrate SQLite and copy/link-safe files incrementally
  -> verify inventory hashes, SQLite, layout, and domain invariants
  -> atomically publish target layout state and boot pointer
  -> reopen from published context and verify again
  -> register prior target as bounded recovery candidate
  -> clean task-owned staging and release leadership
```

For a new target, staging is a sibling on the same filesystem so final rename is
atomic where supported. Cross-volume source copy is allowed because publication
is at the target; source deletion is a later explicit cleanup, never part of the
commit path. The inventory rejects symlink escape, device files, null bytes,
path traversal, unsupported file types, and configured capacity limits.

## `DES-DATA-005`: Safety Point And Secret Policy

The database image uses `VACUUM INTO` or an adapter backup API after the
coordinator has blocked new writers and drained known leases. The non-database
inventory comes from the storage catalog's durable allowlist. `cache/`, `logs/`,
`backups/`, staging, transient SQLite siblings, and Electron browser/runtime
directories are excluded.

Browser/runtime exclusion is a target-state rule, not permission to drop current
state. Before it applies, the compatibility migrator must convert every durable
renderer record to its canonical owner, verify a restart with browser data
cleared, and retain one bounded rollback point. Raw browser directories are
never accepted as the long-term canonical backup format.

One run identity covers updater install, next-version startup, layout migration,
and database migration. Its manifest is incomplete until every required item
and checksum verifies. Retention is bounded simultaneously by count, age, and
total bytes; an in-use recovery point is pinned explicitly.

Recommended `COMPAT-DATA-002` policy:

- same-device safety points may contain encrypted, device-bound secret-store
  ciphertext when the recovery key remains available;
- portable export/sync never contains credential plaintext or device-bound
  ciphertext by default and records which integrations require reauthentication;
- non-secret configuration can be selected after schema validation/redaction;
- plaintext `apiKey` fields in `config/ai-models.json` must migrate to the
  secret store before that file is eligible for portable inclusion.

## `DES-DATA-006`: Journaled Restore And Publication

Cross-domain atomicity is modeled as a recoverable publication protocol:

1. `prepared`: validate envelope/version/signature, plan IDs/conflicts, stage
   SQLite and every selected file domain, and verify the complete candidate.
2. `swapping`: persist a journal containing active/candidate/prior entry names;
   replace entries with atomic renames while services remain closed.
3. `committed`: reopen, verify domain invariants, publish the committed marker,
   and retire the prior set to bounded recovery.

Startup resolves any non-terminal journal before initializing DB classes,
watchers, IPC, Web routes, or renderer stores. It either completes a verifiable
swap or restores the prior entry set. Existing state is never deleted merely to
make room before the corresponding candidate exists and verifies.

Domain-specific merge imports may use domain transactions, but a full restore
does not continue best-effort after failure. The result is success, rolled back,
or recovery-required with an immutable candidate; "completed with file errors"
is not a full-restore success state.

## `DES-DATA-007`: Portable Snapshot Consistency

The snapshot coordinator holds a short consistency barrier while it:

- opens a SQLite read transaction or creates a logical SQLite snapshot;
- freezes the selected filesystem inventory with size, mtime, identity, and
  digest expectations;
- captures versioned non-file state through owning services;
- records envelope version, scope, consistency identity, omissions, and limits.

The barrier is released after the inventory/DB view is fixed. Content streams
through a bounded worker queue and incremental compression/hash pipeline.
Changed files fail or are retried from a newly planned snapshot; they are not
silently mixed. Selective export invokes only selected domain readers.

Renderer code coordinates UI only. Archive creation and large media streaming
run in main/Core so memory is bounded independently of archive size. WebDAV,
S3, and Git transports receive the same verified artifact and do not redefine
its data model.

## `DES-DATA-008`: Recovery Artifact Registry

Managed recovery metadata records artifact type, source root, target root,
operation/run identity, versions, state, size, created/last-used times, pinned
reason, and validation result. Creation is centralized enough to enforce global
count/age/byte limits while domain owners still generate domain content.

New operations do not create adjacent `.backup-*`, `.pre-recovery-*`,
`.prompthub-mcp-backup-*`, or unbounded timestamp directories. Known legacy
patterns are discovered read-only and offered for import/cleanup only after path
and ownership validation. `mcp-version-history-and-projection-safety` removes
MCP sidecars; Agent configuration work adopts the registry for rollback
artifacts rather than a second history implementation.

## `DES-DATA-009`: Diagnostics And Documentation

One read-only diagnostic object is derived from `RuntimeStorageContext`, layout
state, operation journal, database compatibility, and artifact registry. It
reports the actual canonical database path and reasons for legacy/repair state.
It must never expose secret values.

Stable knowledge is updated only after implementation. At convergence it must:

- replace planned config names with actual files and owners;
- include `data/generations` in durable local data;
- distinguish Prompt workspace projection from relational truth;
- state which legacy renderer keys were migrated, their canonical owners, and
  that clearing renderer storage no longer loses durable product state;
- document product topology rather than claiming identical Desktop/Web paths;
- give upgrade, rollback, capacity, and cleanup procedures.

## `DES-DATA-010`: Storage Verification Matrix

| Verification    | Method                                                                                                                            | Risk proved                                                             |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `TEST-DATA-001` | Root fixtures for canonical, legacy, mixed, empty, unrelated, symlinked, and custom roots                                         | One root/layout epoch and safe classification                           |
| `TEST-DATA-002` | Failure/crash injection at every root-migration state transition                                                                  | Source unchanged and deterministic restart recovery                     |
| `TEST-DATA-003` | Low-disk, cross-volume, locked-file, large-entry, Unicode, traversal, and device-file fixtures                                    | Bounded fail-closed migration                                           |
| `TEST-DATA-004` | Concurrent DB writer plus same-device safety point using the real WASM adapter                                                    | Point-in-time SQLite consistency                                        |
| `TEST-DATA-005` | Durable allowlist and secret/redaction inventory test                                                                             | No cache/log/runtime/secret leakage                                     |
| `TEST-DATA-006` | Restore failure at each DB/file/domain publication boundary and restart                                                           | No visible partial restore                                              |
| `TEST-DATA-007` | Selected-scope large-media export with memory/I/O measurement                                                                     | Streaming and no full-library over-read                                 |
| `TEST-DATA-008` | File mutation during export and sync transport retry                                                                              | One logical consistency identity                                        |
| `TEST-DATA-009` | Repeated MCP/Agent/config operations plus retention/cleanup                                                                       | No adjacent or unbounded artifacts                                      |
| `TEST-DATA-010` | Desktop/CLI shared root and Web multi-user isolation fixtures                                                                     | Explicit product topology                                               |
| `TEST-DATA-011` | Diagnostics against canonical/legacy/migrating/recovery states                                                                    | Reported path and stage match runtime truth                             |
| `TEST-DATA-012` | Legacy renderer fixtures containing settings, credentials, store sources, device IDs, variable history, and IndexedDB data        | One-time migration, secret isolation, restart, and browser-clear safety |
| `TEST-DATA-013` | Delete/stage-rebuild the local SQLite catalog from canonical files and compare domain identities, relations, versions, and hashes | Local database is reproducibly rebuildable without data loss            |

## `DES-DATA-011`: File-First Authority And Renderer Demotion

`COMPAT-DATA-003` is implemented as a staged authority transition, not a flag
that immediately ignores the database or deletes browser state:

1. Define versioned canonical bundles/manifests for every local durable domain.
   Prompt bundles must cover fields currently missing from workspace Markdown,
   including versions, relations, output-format links, media references, and
   any PromptHub-owned metadata that must survive a database rebuild.
2. Add a one-time renderer-state migrator. It reads allowlisted legacy keys,
   validates their schema, writes canonical configuration/domain files and the
   device-bound secret store atomically, verifies reload, then records a durable
   completion marker outside renderer storage.
3. Build a new SQLite catalog in a staged path by streaming canonical manifests
   through bounded batches. Compare stable IDs, counts, hashes, graph edges,
   versions, and domain invariants with the active database.
4. Keep the active database authoritative during shadow comparison. Publish the
   rebuilt database and file-first authority epoch only after verification;
   otherwise discard the stage and preserve current state.
5. Remove dual-authority newer-wins merges only after restart, downgrade, import,
   restore, and browser-clear fixtures prove the cutover.

Current renderer persistence is assigned as follows:

| Current state                               | Target owner                                             | Transition                                                                     |
| ------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `prompthub-settings` non-secret settings    | versioned main/Core configuration                        | validate and atomically migrate                                                |
| sync/provider/proxy credentials and AI keys | device-bound secret store                                | extract, encrypt, verify, then redact renderer/config copies                   |
| custom Skill/MCP/Plugin store sources       | canonical marketplace-source config                      | migrate with stable IDs and deduplicate                                        |
| Desktop/self-hosted device identities       | main/server configuration                                | preserve identity and move outside disposable cache                            |
| `prompt_vars_<id>` history                  | explicit bounded Prompt history or explicit cache policy | migrate only if product behavior declares it durable; otherwise cap and expire |
| manual recovery paths                       | main recovery registry                                   | canonicalize, validate, and avoid renderer-only ownership                      |
| UI/filter/column/selection state            | renderer LocalStorage                                    | keep as versioned bounded preferences                                          |
| Agent quota and remote catalog results      | renderer cache                                           | keep with TTL, capacity, and invalidation                                      |
| clipboard signatures and reload cooldown    | SessionStorage                                           | keep session-only                                                              |
| legacy Prompt IndexedDB                     | one-time recovery/import source                          | quarantine until verified import, then retire by policy                        |

SQLite tables are classified per table before cutover. Content/catalog tables
must be reproducible from canonical files; migration journals, leases, and other
operational tables remain database-owned; self-hosted authentication and remote
service tables remain explicit server-authoritative exceptions.

## Current Mechanism Audit

The shared initializer currently has no single ordered compatibility model.
`packages/db/src/init.ts` infers currentness from three manually maintained
surfaces: required tables, required columns, and selected migration names. It
then creates current tables, runs imperative conditionals, and creates indexes.
Desktop wraps this with multiple independent backup and migration stages.

| Finding           | Current evidence                                                                                                                         | Consequence                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `AUDIT-DBMIG-001` | Three migration error handlers return from the transaction callback. `DatabaseAdapter.transaction` commits every normal return.          | Earlier statements commit, later migrations are skipped, and startup can report success.               |
| `AUDIT-DBMIG-002` | `backfill_local_repo_path_v1` is marked complete even when the Desktop-only resolver hook is absent.                                     | CLI/Web-first initialization can permanently suppress Desktop reconciliation.                          |
| `AUDIT-DBMIG-003` | `agent_conversation_handoff_launch_v2` rebuilds and drops a table but is absent from `REQUIRED_MIGRATION_NAMES`.                         | Backup planning can miss a destructive migration.                                                      |
| `AUDIT-DBMIG-004` | `SCHEMA_TABLES` and `SCHEMA_INDEXES` execute outside the migration transaction.                                                          | Failed initialization can leave schema objects that are not represented by migration history.          |
| `AUDIT-DBMIG-005` | Pre-migration and integrity backups use raw `copyFileSync` before a migration owner and SQLite snapshot contract are established.        | A consistent point-in-time image is not proven for concurrent/shared access.                           |
| `AUDIT-DBMIG-006` | Updater install, next-version startup, layout migration, legacy 0.5.3 defense, integrity repair, and recovery create independent copies. | One upgrade can create duplicate safety data with different retention and failure semantics.           |
| `AUDIT-DBMIG-007` | The 0.5.3 defensive backup swallows backup failure and continues.                                                                        | The implementation conflicts with the stable rule that required migration backup failure stops writes. |
| `AUDIT-DBMIG-008` | `schema_migrations` stores only name/time; no numeric maximum or checksum is checked.                                                    | Downgrades and edited historical migration definitions cannot be detected safely.                      |
| `AUDIT-DBMIG-009` | The global shared singleton returns the first database for every later path.                                                             | A process can silently receive a database different from the requested path.                           |
| `AUDIT-DBMIG-010` | Layout migration and renderer IndexedDB import maintain separate markers outside shared migration history.                               | Retry order and one-safety-point behavior are not coordinated end to end.                              |

## `DES-DBMIG-001`: Ownership And Modules

`packages/db` owns the shared SQLite compatibility boundary. The current mixed
initializer is split before more migrations are added:

```text
packages/db/src/migrations/
  types.ts           # immutable migration and plan contracts
  manifest.ts        # ordered registry and supported version
  compatibility.ts   # legacy adoption, newer-version rejection
  runner.ts          # transaction, history, version advancement
  verification.ts    # schema, history, quick-check, domain invariants
  safety-point.ts    # SQLite-consistent managed database image
```

`packages/core` continues to own runtime paths, not schema migration. Desktop
main owns the application upgrade-stage coordinator and native filesystem
reconciliation. Renderer code may display progress or recovery state but does
not decide compatibility or write migration markers.

Mobile Expo SQLite and Cloudflare D1 keep independent manifests because their
storage engines and schemas are different. They are architecture peers, not
additional callers of the desktop/shared SQLite runner.

## `DES-DBMIG-002`: Version And History Model

`PRAGMA user_version` is the numeric compatibility gate. A new
`database_migration_history` table records only committed migrations:

```text
migration_id INTEGER PRIMARY KEY
name TEXT NOT NULL UNIQUE
checksum TEXT NOT NULL
app_version TEXT NOT NULL
applied_at INTEGER NOT NULL
duration_ms INTEGER NOT NULL
```

Each manifest entry has an immutable integer ID, name, checksum, impact flags,
`apply`, and `verify`. Existing entries are never edited; corrections receive a
new ID. The legacy `schema_migrations` table remains an adoption input until all
supported legacy states have been translated and tested; it is not silently
reinterpreted as the new history table.

Version `0` has two meanings that preflight distinguishes without writing:

1. no durable schema: apply the registry from the beginning;
2. legacy unversioned schema: validate a recognized invariant and apply the
   explicit adoption path.

An unrecognized or partially matching schema fails closed. A newer
`user_version` fails before the initializer creates tables or rewrites the
last-run application marker.

## `DES-DBMIG-003`: Planning And Transaction Boundary

The runner builds one plan from the manifest. The same plan determines whether
a safety point is required, which migrations execute, what verifies, and what
history/version values commit. There is no second currentness list.

For each plan, schema DDL, deterministic data transforms, history rows, and the
final `user_version` execute in one SQLite transaction. Any error is rethrown.
A migration may explicitly be inapplicable before the transaction is started;
it cannot become "deferred" through a normal return after writes begin.

Fresh schema creation uses the same registry. If a generated current-schema
bootstrap is retained for startup performance, CI must prove byte-independent
logical equivalence to applying every migration from an empty database.

## `DES-DBMIG-004`: Migration Leadership

A path-scoped migration intent is acquired atomically before inspection that can
lead to a safety point. All current Desktop/CLI/Web callers check the intent
before opening the database. The coordinator then examines registered client
leases and refuses destructive work while another live or unknown client exists.

Leadership uses a finite wait and exposes `DATABASE_MIGRATION_BUSY`; it does not
reuse ownerless-lock recovery as permission to delete a live database lock.
Normal current-schema opens continue to use the stable bounded SQLite
`busy_timeout` contract.

## `DES-DBMIG-005`: Managed Safety Point

The canonical safety point lives below the managed backup root and has a stable
run identity derived from source root, from/to app versions, from/to database
versions, and reason. Its manifest records completion only after every copied
item and the database image verify.

The implementation must use a SQLite-native consistent-copy primitive. The
first implementation spike verifies `VACUUM INTO` with the WASM adapter under
the real lock/lease model; if unsupported, the adapter must expose SQLite's
backup API. Raw copying of the live database is not an accepted fallback.
Non-database durable files are staged with link-safe paths, bounded traversal,
and an atomic manifest publish.

Updater install and next-version startup share the run identity. Install pauses
new writes, creates the safety point, and records a pending upgrade intent;
startup validates and reuses that point. When install cannot create it, install
stops. Retention remains bounded and includes integrity/recovery artifacts under
the same inventory instead of leaving unbounded timestamped siblings.

## `DES-DBMIG-006`: Desktop Upgrade State Machine

Desktop runs the following bounded stages:

```text
resolve active root
  -> acquire migration leadership and inspect integrity/version
  -> create or reuse one managed safety point
  -> migrate filesystem layout
  -> run shared SQLite migrations
  -> run Desktop filesystem reconciliation
  -> import/reconcile legacy IndexedDB
  -> verify restart-visible invariants and finalize the run
```

Each stage owns an idempotent completion record written after verification.
SQLite history is not used for filesystem work. A later-stage failure stops the
run and retries only incomplete stages; it never creates another safety point
for the same completed run identity.

A missing last-run marker is considered a fresh install only when the active
root contains no durable data. Downgrade detection preserves the highest
last-seen version and never rewrites the marker downward.

## `DES-DBMIG-007`: Host Reconciliation

`local_repo_path` discovery moves out of shared schema history. Desktop scans
only configured Skill roots with bounded traversal and records an idempotent
reconciliation result keyed by reconciler version. CLI/Web can leave the field
empty without suppressing the later Desktop pass.

Other future host-dependent repairs must use the same reconciliation boundary;
a schema migration may never call Electron, home-directory discovery, or a
platform-specific filesystem hook.

## `DES-DBMIG-008`: Verification And Recovery

Before publication, the runner checks:

- `PRAGMA quick_check` is exactly healthy;
- `user_version`, ordered history IDs, names, and checksums match the plan;
- required tables, indexes, foreign keys, and changed constraints exist;
- migration-specific domain invariants hold;
- a fresh reopen obtains the same result.

A failed transaction rolls back without a history row. A post-commit publication
failure retains diagnostics and the managed safety point, then follows the
staged recovery contract. Automatic integrity repair remains restricted to the
existing freelist and verified-index cases.

## `DES-DBMIG-009`: Verification Matrix

| Verification     | Method                                                        | Risk proved                                                  |
| ---------------- | ------------------------------------------------------------- | ------------------------------------------------------------ |
| `TEST-DBMIG-001` | Real SQLite fresh/current/legacy/newer fixture matrix         | Compatibility and ordered planning                           |
| `TEST-DBMIG-002` | Failure injection before and after every changed statement    | Transaction rollback and no false completion                 |
| `TEST-DBMIG-003` | CLI-first, Web-first, then Desktop restart                    | Host reconciliation remains executable                       |
| `TEST-DBMIG-004` | Destructive handoff migration fixture                         | Automatic safety-point requirement and data preservation     |
| `TEST-DBMIG-005` | Updater/startup/layout duplicate-run fixture                  | One reusable safety point and bounded retention              |
| `TEST-DBMIG-006` | Concurrent process/lease/intent integration                   | One leader, finite busy failure, no lock deletion            |
| `TEST-DBMIG-007` | Corrupt/checksum/unknown partial state fixtures               | Fail-closed verification and recovery candidate              |
| `TEST-DBMIG-008` | Layout success plus IndexedDB import failure/retry            | Stage idempotence and no duplicate rows                      |
| `TEST-DBMIG-009` | v0.4.7/v0.4.8/v0.5.1/v0.5.2 tagged fixtures                   | Historical #89/#97/#98 regression evidence                   |
| `TEST-DBMIG-010` | Large database and low-disk fixture with resource measurement | `O(B)` disk/time, bounded memory, pre-write capacity failure |

## Pre-Implementation Consistency Analysis

- The current mechanism has present-tense correctness gaps; implementation must
  not wait for a historical fixture to fail.
- Storage layout and database migration are coupled at publication time but keep
  separate owners: `packages/db` never moves roots, and Desktop never implements
  private schema migration logic.
- The stable v0.5.5 per-getter fallback and the proposed process-wide layout
  epoch materially differ. `COMPAT-DATA-001` remains `[待确认]`; production path
  changes are blocked until the compatibility consequence is accepted.
- Stable docs say configuration is safely backupable, while current
  `config/ai-models.json` can contain plaintext keys. `COMPAT-DATA-002` remains
  `[待确认]`; portable config inclusion is blocked until secret ownership is
  corrected.
- Stable docs and current code treat SQLite as authoritative for local relational
  data, while the requested hierarchy makes files authoritative and renderer
  storage disposable. `COMPAT-DATA-003` was confirmed on 2026-08-10. Production
  authority switching remains gated by complete canonical schemas, shadow
  rebuild comparison, restart evidence, and rollback verification.
- The dedicated change does not conflict with `legacy-upgrade-recovery-audit`:
  this change owns shared migration safety, while that change owns tagged
  historical recovery evidence.
- `mcp-version-history-and-projection-safety` remains the MCP implementation
  owner; this change supplies the cross-domain artifact-class and retention
  contract. `desktop-image-generation-workbench` remains the generation storage
  owner. `git-backup-transports` remains transport-only.
- `web-sync-contract-completion` already documents that Desktop restore is not a
  cross-entity transaction. This design makes the missing staged publication
  explicit instead of claiming that current restore is transactional.
- Stable recovery documentation already requires fail-closed backup behavior;
  the current 0.5.3 wrapper is an implementation discrepancy, not a new policy.
- The SQLite-consistent snapshot primitive requires a capability test before
  production replacement, but both acceptable outcomes preserve the same user
  and storage contract.

## Data Storage Traceability

| Requirement   | Design                         | Verification                     | Task                                     |
| ------------- | ------------------------------ | -------------------------------- | ---------------------------------------- |
| `FR-DATA-001` | `DES-DATA-001`                 | `TEST-DATA-005`, `TEST-DATA-009` | `T-DATA-002`                             |
| `FR-DATA-002` | `DES-DATA-002`                 | `TEST-DATA-001`, `TEST-DATA-011` | `T-DATA-003`                             |
| `FR-DATA-003` | `DES-DATA-004`                 | `TEST-DATA-002`, `TEST-DATA-003` | `T-DATA-004`, `T-DATA-005`               |
| `FR-DATA-004` | `DES-DATA-001`, `DES-DATA-008` | `TEST-DATA-009`                  | `T-DATA-002`, `T-DATA-010`               |
| `FR-DATA-005` | `DES-DATA-005`                 | `TEST-DATA-004`, `TEST-DATA-005` | `T-DATA-006`                             |
| `FR-DATA-006` | `DES-DATA-006`                 | `TEST-DATA-006`                  | `T-DATA-007`                             |
| `FR-DATA-007` | `DES-DATA-007`                 | `TEST-DATA-007`, `TEST-DATA-008` | `T-DATA-008`                             |
| `FR-DATA-008` | `DES-DATA-008`                 | `TEST-DATA-009`                  | `T-DATA-010`                             |
| `FR-DATA-009` | `DES-DATA-003`                 | `TEST-DATA-010`                  | `T-DATA-009`                             |
| `FR-DATA-010` | `DES-DATA-009`                 | `TEST-DATA-011`                  | `T-DATA-011`                             |
| `FR-DATA-011` | `DES-DATA-011`                 | `TEST-DATA-012`, `TEST-DATA-013` | `T-DATA-015`, `T-DATA-016`, `T-DATA-017` |

## Database Migration Traceability

| Requirement    | Design          | Verification                                         | Task                         |
| -------------- | --------------- | ---------------------------------------------------- | ---------------------------- |
| `FR-DBMIG-001` | `DES-DBMIG-002` | `TEST-DBMIG-001`, `TEST-DBMIG-007`                   | `T-DBMIG-002`, `T-DBMIG-003` |
| `FR-DBMIG-002` | `DES-DBMIG-003` | `TEST-DBMIG-002`                                     | `T-DBMIG-004`                |
| `FR-DBMIG-003` | `DES-DBMIG-003` | `TEST-DBMIG-004`                                     | `T-DBMIG-003`, `T-DBMIG-004` |
| `FR-DBMIG-004` | `DES-DBMIG-007` | `TEST-DBMIG-003`                                     | `T-DBMIG-005`                |
| `FR-DBMIG-005` | `DES-DBMIG-005` | `TEST-DBMIG-004`, `TEST-DBMIG-005`, `TEST-DBMIG-010` | `T-DBMIG-006`                |
| `FR-DBMIG-006` | `DES-DBMIG-004` | `TEST-DBMIG-006`                                     | `T-DBMIG-007`                |
| `FR-DBMIG-007` | `DES-DBMIG-008` | `TEST-DBMIG-002`, `TEST-DBMIG-007`                   | `T-DBMIG-008`                |
| `FR-DBMIG-008` | `DES-DBMIG-006` | `TEST-DBMIG-005`, `TEST-DBMIG-008`                   | `T-DBMIG-009`                |
| `FR-DBMIG-009` | `DES-DBMIG-009` | `TEST-DBMIG-009`, `TEST-DBMIG-010`                   | `T-DBMIG-010`                |
