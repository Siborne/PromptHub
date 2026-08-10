# Data Storage Safety Delta Specification

## Added Requirements

### `FR-DATA-001`: Canonical Storage Catalog

PromptHub must classify every durable or generated artifact by owner, source of
truth, physical location, backup/sync eligibility, retention, and recovery
behavior. At minimum the catalog distinguishes relational data, durable file
content, derived projections, device configuration, secrets, cache, logs,
domain version history, operation rollback material, managed safety points,
portable snapshots, and read-only recovery candidates.

#### Scenario: A new persistent file is introduced

Before the file is written in production, its active change identifies its
storage class, canonical runtime-path helper, owner, inclusion in same-device
safety points, portable export policy, cleanup rule, and restart behavior. A
file without that catalog entry fails the storage-boundary review.

### `FR-DATA-002`: One Active Root And Layout Epoch

Desktop and CLI must resolve one active local root and one complete layout epoch
before opening the database or returning any durable domain path. A process may
not independently select a canonical database path, legacy Skill path, legacy
Prompt path, or root-level media path after that decision.

#### Scenario: Canonical database and legacy Skills both exist

Preflight detects a mixed layout and does not expose a hybrid set of paths to
services. It either binds a recognized complete legacy epoch read-only pending
migration, completes a staged migration to the canonical epoch, or reports a
repair decision. It never opens the canonical database while writing legacy
Skills by an unrelated getter fallback.

### `FR-DATA-003`: Staged Data-Root Change

Data-root `switch`, `migrate`, and `overwrite` operations must inventory and
classify the source and target, reject unsafe symlinks and ambiguous non-empty
targets, verify capacity, enter a bounded maintenance barrier, stage the full
result on the target filesystem, verify hashes and SQLite invariants, and only
then atomically publish the boot pointer and layout state. The source must not
be mutated before publication.

#### Scenario: Copy fails halfway through migration

The published boot pointer still identifies the original root, the original
root remains unchanged, the incomplete stage is marked failed and can be
cleaned safely, and restart opens the original data. No service observes a
partially copied target.

#### Scenario: User selects an arbitrary non-empty directory

If the target is not an empty directory or a recognized PromptHub root with a
valid manifest, PromptHub refuses switch/overwrite before writing. It reports
the unknown entries and does not infer ownership from an empty `logs/`,
`config/`, or `data/` directory alone.

### `FR-DATA-004`: Distinct Version, Rollback, Backup, And Recovery Artifacts

PromptHub must not use one unnamed "backup" mechanism for different product
semantics. Domain version history, ephemeral projection rollback, managed
safety points, portable backup/sync snapshots, and recovery candidates must
have distinct locations, metadata, retention, and user-facing names.

#### Scenario: MCP is projected to an Agent configuration

The MCP domain version is retained in PromptHub-managed history. The external
file is replaced atomically with ephemeral rollback material that is removed
after verification. Repeated edits do not leave timestamped
`.prompthub-mcp-backup-*` files beside the Agent configuration.

### `FR-DATA-005`: Consistent Allowlisted Safety Points

A same-device safety point must be built from an explicit durable allowlist and
one SQLite-consistent image. It must exclude cache, logs, prior backups, staging
directories, transient database siblings, and Electron browser/runtime state.
The manifest records source root, layout/database versions, reason, inventory,
hashes, completion, and secret policy. Retention is bounded.

#### Scenario: Upgrade snapshot runs while the database has pending writes

The coordinator first prevents new writers and drains known clients, then uses
`VACUUM INTO` or a supported SQLite backup API. Raw copying the live database is
not an accepted fallback. If a consistent image cannot be created, the upgrade
stops before changing durable state.

### `FR-DATA-006`: Journaled Cross-Domain Restore

Restore across SQLite, durable files, settings, and domain services must be
preflighted and staged before the active state changes. A durable journal and
per-entry atomic replacement must make `prepared`, `swapping`, and `committed`
states restart-recoverable. Restore may not delete current Skills or other
domains before their replacements validate.

#### Scenario: Skill restore fails after database preparation

The active database, Skills, and assets remain on the prior committed set, or
startup deterministically completes/rolls back the recorded swap before opening
services. The UI never reports a successful restore with silently missing
Skills and does not rely on a best-effort error list after partial mutation.

### `FR-DATA-007`: Consistent And Bounded Portable Snapshot

Portable export and sync must use a versioned envelope produced from one
consistent logical snapshot. Selected scopes query and traverse only selected
domains. Files are streamed with bounded concurrency, size, depth, and entry
limits; the renderer must not retain the entire media set or ZIP in memory.
Portable snapshots exclude secrets by default and declare omitted credentials.

#### Scenario: User exports Prompts only from a large library

The exporter does not load Skills, Plugins, MCP packages, generation assets, or
unselected media merely to filter them later. Memory remains bounded by the
configured chunk/queue size and the snapshot identifies the consistency point.

### `FR-DATA-008`: Centralized Bounded Recovery Artifacts

Recovery candidates and safety points must live under the managed recovery or
backup root, have stable identities and manifests, and obey finite retention.
PromptHub may discover legacy adjacent database/MCP/Agent backup files
read-only, but new operations must not create unbounded timestamped siblings or
per-Agent backup trees without cleanup.

#### Scenario: The same Agent configuration is changed repeatedly

Each operation either removes its verified rollback material or registers a
bounded managed recovery artifact. The Agent directory contains only native
configuration, not an ever-growing history of PromptHub sidecars.

### `FR-DATA-009`: Explicit Product Storage Topology

Desktop and CLI share the selected local single-user root contract.
Self-hosted Web uses a server-controlled multi-user physical root. Expo mobile
SQLite and Cloudflare D1 remain separate storage engines. Shared contracts may
standardize logical envelopes and domain identities, but documentation and code
must not claim identical physical paths across these products.

#### Scenario: Self-hosted Web stores media for two users

Each user resolves an isolated server-owned subtree. A Desktop path such as
`data/assets/images` is not hardcoded as the Web physical location, while an
exported logical media entry still follows the shared portable envelope.

### `FR-DATA-010`: Accurate Diagnostics And Stable Documentation

Diagnostics must report the selected root, layout epoch, canonical database
path, operation stage/journal, storage class, and recovery artifact type from
the same resolved state used by services. Stable documentation must name actual
configuration files and storage behavior; planned paths cannot be presented as
already shipped.

#### Scenario: Canonical database is under `data/`

The data-path summary checks and reports `data/prompthub.db`, not only a legacy
root-level database. Configuration documentation reports actual ownership of
`config/ai-models.json`, settings, Agent secrets, and generated assets after the
implementation has converged.

### `FR-DATA-011`: File-First Local Persistence Hierarchy

For Desktop and local CLI roots, versioned files must be the canonical source of
truth for user-owned durable domains. Local SQLite must be rebuildable from those
files as a transactional catalog, query/index layer, and explicitly classified
operational store. Renderer LocalStorage, IndexedDB, and SessionStorage must hold
only bounded disposable cache, view preferences, migration markers, or session
state. They must not be the only owner of content, configuration, credentials,
device identity, marketplace sources, version history, or recovery metadata.

Server-owned authentication, refresh tokens, concurrency leases, and remote
service state are explicit database-authoritative exceptions. They are not
silently converted into local user-editable files by this requirement.

#### Scenario: Renderer storage is cleared

After the one-time compatibility migration has completed, clearing Electron
LocalStorage, IndexedDB, and SessionStorage and restarting PromptHub preserves
all user content, non-secret configuration, credentials, sync identities,
marketplace sources, and version history. Only disposable UI/cache state is
recreated or reset.

#### Scenario: The local SQLite catalog is rebuilt

PromptHub stages a new database from canonical files, validates counts, stable
identities, hashes, Prompt versions, relations, output-format links, media
references, Skill/Rule/MCP/Plugin state, and PromptHub-owned Agent metadata, then
atomically publishes it. A missing or malformed canonical record fails closed;
the active database remains unchanged.

## Non-Functional Requirements

- `NFR-DATA-001`: Root discovery and inventory are `O(E + B)` in visited entries
  and bytes; traversal, size, depth, retries, concurrency, and output are bounded.
- `NFR-DATA-002`: Migration and restore use streaming or incremental copy/hash;
  memory is bounded independently of total durable data size.
- `NFR-DATA-003`: Pointer, manifest, marker, and journal publication use
  write-flush-rename semantics appropriate to the platform.
- `NFR-DATA-004`: Path input is allowlisted and canonicalized; symlink escape,
  traversal, null bytes, device files, and unknown ownership fail closed.
- `NFR-DATA-005`: Secrets never appear in plaintext portable snapshots, logs,
  diagnostics, manifests, or test fixtures.
- `NFR-DATA-006`: Every new storage mutation branch has failure-injection,
  restart, rollback, large-inventory, low-disk, and cleanup evidence with 100%
  changed branch/condition coverage.
- `NFR-DATA-007`: Renderer caches have explicit schema versions, capacity and
  invalidation rules. Canonical-file scanning and database rebuild are streaming
  or incremental, use bounded concurrency, and complete in `O(E + B)` over
  visited entries and bytes.

## Compatibility Decisions

- `[待确认] COMPAT-DATA-001`: replace per-getter dual-read with one preflight
  legacy/canonical layout-epoch decision during the v0.6 line, while retaining
  read compatibility until the documented v0.7 removal boundary.
- `[待确认] COMPAT-DATA-002`: same-device safety points may retain encrypted
  device-bound secret blobs; portable snapshots exclude them and require
  reauthentication after restore.
- `[confirmed 2026-08-10] COMPAT-DATA-003`: adopt file-first authority for local user-owned
  durable domains, rebuildable SQLite catalog/index projections plus classified
  operational tables, and disposable renderer storage. Server authentication
  and remote service state remain explicit database-authoritative exceptions.
