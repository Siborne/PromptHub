# Legacy Upgrade Recovery Audit Design

<!-- traceability: enforced -->

## `DES-LEGACYREC-001`: Evidence And Fixture Boundary

Generate fixtures from tagged source contracts rather than preserving binaries
from a user's machine. A fixture manifest records source tag, artifact kind,
platform, logical path, schema/table inventory, expected row counts, stable
content hashes, and Prompt-version order. Fixture builders create deterministic
SQLite/JSON/filesystem layouts in test-owned temporary directories.

The harness first asserts that the fixture represents the historical condition,
then executes it through the current implementation. A report is reproduced only
when the current observable invariant fails; issue text or a matching path alone
is not sufficient.

## `DES-LEGACYREC-002`: Ownership And Dependency Direction

- `packages/core/src/runtime-paths.ts` remains the owner of canonical current
  runtime paths and legacy fallback helpers shared across products.
- `packages/db` remains the owner of SQLite schema, migrations, integrity checks,
  and Prompt-version row invariants.
- `apps/desktop/src/main/services/recovery-paths.ts` and the adjacent recovery,
  data-layout, and upgrade-backup services own desktop legacy candidate
  enumeration, read-only inspection, staging, and native restore orchestration.
- `packages/shared` owns typed recovery contracts only when a reproduced fix
  changes the renderer/main boundary.
- The renderer presents candidates and confirmation state; it does not choose a
  durable source or implement migration rules.

This corrects the earlier generic proposal to move candidate discovery into
`packages/core`. Desktop-specific Windows installation history and Electron
orchestration stay in the desktop main process unless another product proves a
shared requirement.

## `DES-LEGACYREC-003`: Issue #89 Path Transition Test

Repository tags show that v0.4.7 could use an install-scoped `data` directory,
while v0.4.8 excluded the default per-user Windows install directory under
`AppData\\Local\\Programs` and fell back to roaming application data. The issue
comments report the same transition.

The fixture therefore contains two independent roots:

1. a valid legacy v0.4.7 dataset under the install directory;
2. an empty or newer current roaming root selected by current runtime rules.

Current `getRecoveryCandidatePaths` already allowlists the legacy install path.
The test must prove candidate visibility, source provenance, cancel-without-write,
explicit recovery, record equality, and restart behavior before any production
change is considered. It must also cover a custom install directory, case-folded
duplicates, a missing path, a locked database, and a corrupt candidate.

## `DES-LEGACYREC-004`: Issue #97 Artifact Routing

The historical v0.5.1 portable backup and v0.5.2 portable backup both declare
backup format version 1 and contain an explicit `versions` collection. The
v0.5.2 automatic upgrade snapshot is a different directory artifact with a
manifest and copied user-data entries. They must not share a guessed parser.

The v0.5.1 JSON fixture runs through the current portable import path. The
v0.5.2 directory fixture runs through upgrade-backup inventory and restore. Both
must validate before publication, create the existing safety point, preserve
records and media references after restart, and restore the previous current
state after injected failure.

## `DES-LEGACYREC-005`: Issue #98 History Invariant

Current `PromptDb.getVersions` orders all matching rows by version and has no
oldest/latest limit. Current UI tests also render an intermediate version. The
remaining risk is therefore the legacy import/migration chain, identity mapping,
or a tagged data-shape edge case rather than the current query alone.

The fixture uses versions 1 through 4 with distinct IDs, timestamps, content,
variables, and notes. Verification compares the ordered database inventory,
IPC result, history UI, restart result, and intermediate rollback. Row-count-only
assertions are insufficient because duplicate or substituted versions can keep
the same count.

## `DES-LEGACYREC-006`: Minimal Remediation And Rollback

Do not add a second recovery engine from this historical-fixture change before
the tagged tests fail. The separate `database-migration-safety` change owns
current shared migration correctness independent of those results. A reproduced
historical gap is fixed in its existing owner:

- path enumeration or candidate metadata in desktop recovery services;
- SQLite migration/history integrity in `packages/db`;
- portable artifact parsing/import in the existing backup service;
- renderer behavior only when durable data and IPC are already correct.

Recovery copies the selected source into a task-owned staging directory, applies
the existing migration there, validates SQLite and domain invariants, produces a
preview, creates the established insurance snapshot, and atomically publishes.
Failures clean staging and retain the active source. Retry uses the same source
identity and is idempotent.

## `DES-LEGACYREC-007`: Capacity And Performance

For `K` fixed candidate roots, enumeration is `O(K)` plus bounded metadata work.
Prompt-history validation is `O(V)` for `V` versions. Artifact staging is
`O(B)` time and temporary disk for `B` accepted bytes, with one staged copy and
no full-byte in-memory copy. Test parameters set finite limits for candidate
count, depth, entries, bytes, and concurrency.

If remediation touches recursive candidate inspection, that path must gain and
test explicit traversal limits rather than inheriting an unbounded filesystem
walk.

## `DES-LEGACYREC-008`: Empty Prompt Version-Chain Repair

Keep the positive-version canonical resource contract strict. Repair the legacy
SQLite invariant in `packages/db` before the canonical graph is materialized:

1. insert one version-1 snapshot from each Prompt row that has no version rows;
2. align each Prompt counter to its highest positive stored version;
3. record the named migration in the existing migration transaction.

The repair uses two set-based SQL statements and is idempotent. For `P` Prompts
and `V` version rows, the indexed existence and maximum-version work is bounded
by the database query plan rather than per-Prompt application queries; no Prompt
payloads are loaded into application memory. Existing valid version rows are
not rewritten or deleted.

Canonical publication invokes source-database preparation only after the
renderer migration gate, authority check, and source-file safety check pass.
Preparation opens the source through `initDatabase()`, applies the normal
migration transaction, and closes it before the projector reads the source.
Preparation failure stops publication, so an invalid pre-migration graph cannot
become the canonical authority.

## `DES-LEGACYREC-009`: Empty Rule Placeholder Boundary

Keep Rule resource validation strict and narrow the projector input instead.
The projector omits a Rule only when all placeholder signals agree:

- `sync_status` is `target-missing`;
- `current_version` is zero;
- neither managed nor target content exists; and
- no version history exists.

This is a constant-time decision per already-enumerated Rule and does not add
filesystem scans or database queries. Records with any durable content or
history continue through the canonical schema and therefore cannot bypass the
positive-version invariant.

## `DES-LEGACYREC-010`: Explicit Coexistence Artifacts

The canonical readers use exact-name, exact-type exclusions for artifacts that
are independently owned in the shared data root:

- Prompt graph inventory skips root `.versions` only when it is a non-symlink
  directory owned by the legacy Prompt workspace;
- Prompt graph inventory skips root `agent-appearance` only when it is a
  non-symlink directory owned by Agent appearance themes and pets;
- MCP bundle enumeration skips `market-sources.json` only when it is a
  non-symlink regular file owned by the MCP market source registry, and skips
  the superseded `library.json` only when it is a non-symlink regular file;
- Plugin bundle enumeration skips superseded `library.json`,
  `market-cache.json`, and `versions.json` only when each entry is a
  non-symlink regular file.

No prefix or extension-wide exclusion is allowed. Prompt graph verification
continues to hash every declared file and reject other undeclared files. MCP
and Plugin enumeration count only bundle directories against their resource
limits. All scans remain linear in the number of root entries plus owned files.

The production MCP and Plugin service readers add a one-time compatibility
step above raw bundle enumeration. They first validate and read canonical
state. If canonical resources exist, they delete only the exact superseded
metadata files and keep canonical state authoritative. If canonical state is
empty, they parse the superseded library through the existing normalization,
publish all records through the existing journaled bundle writer, verify the
published state, and only then remove the old metadata. MCP credentials pass
through the existing device-bound secret store and are never copied into bundle
JSON. A parse, validation, secret-store, package, or publication failure occurs
before cleanup, so the old library remains available for retry. The migration
is `O(R + P)` for `R` records and bounded Plugin package files `P`, with one
journaled publication and no network work.

Renderer persistence permits a null `selfHostedDeviceId` before self-hosted
sync is configured. Canonical MCP bindings and Plugin projections therefore use
the persisted device ID when available and otherwise derive a deterministic,
root-scoped local identity. Malformed non-null IDs, symlinks, and identity
mismatches remain fail-closed.

## `DES-LEGACYREC-011`: Older Writer And Invalid Authority Gate

Compare the current application version with the durable last-writer version
before opening SQLite or initializing any workspace writer. A strictly older
application fails closed and must not rewrite the marker downward. Version
comparison must use the repository's prerelease-aware version utility rather
than numeric splitting.

An existing canonical authority marker is necessary but not sufficient. Startup
must validate the canonical catalog and every declared resource before returning
`already-canonical`. Invalid authority produces a recovery-required result with
read-only candidate metadata. SQLite, legacy Markdown, and safety points remain
separate candidates; modification time or record count cannot select a winner.
Only an explicit user choice may stage, validate, and atomically publish one
candidate through the existing recovery boundary. Candidate inspection is
linear in declared files and bounded by the existing catalog and recovery limits.

Until candidate selection is complete, desktop startup skips Prompt workspace
synchronization for an invalid authority. This prevents the normal DB-to-graph
publisher from repeatedly reading or replacing the damaged graph while keeping
the application available for recovery operations.

The current SQLite catalog is surfaced as an explicit recovery candidate when
it passes read-only integrity and content inspection. Selecting that candidate
creates a closed-database checkpoint, projects and validates the complete
canonical shadow in staging, preserves the damaged active root as a journaled
recovery artifact, and atomically publishes the selected catalog. Startup never
selects this candidate automatically, and the ordinary first-publication API
continues to reject an existing authority marker.

## Analyze Result

- #89 has a credible tag-backed path-transition explanation and a matching
  current recovery candidate path, but end-to-end recovery remains unproven.
- #97 combines two different artifact types; compatibility must be verified
  independently for each.
- #98 is not explained by the current all-version query. No query or schema
  change is justified until the tagged history fixture fails.
- The current delivery cut has no material source-of-truth conflict: SQLite and
  managed data remain canonical, while legacy artifacts are recovery inputs.

## Traceability

| Requirement         | Design                                   | Verification                                                     | Task              |
| ------------------- | ---------------------------------------- | ---------------------------------------------------------------- | ----------------- |
| `FR-LEGACYREC-001`  | `DES-LEGACYREC-001`                      | `TEST-LEGACYREC-089`, `TEST-LEGACYREC-097`, `TEST-LEGACYREC-098` | `T-LEGACYREC-002` |
| `FR-LEGACYREC-002`  | `DES-LEGACYREC-002`, `DES-LEGACYREC-003` | `TEST-LEGACYREC-089`                                             | `T-LEGACYREC-003` |
| `FR-LEGACYREC-003`  | `DES-LEGACYREC-004`, `DES-LEGACYREC-006` | `TEST-LEGACYREC-097`, `TEST-LEGACYREC-004`                       | `T-LEGACYREC-004` |
| `FR-LEGACYREC-004`  | `DES-LEGACYREC-005`, `DES-LEGACYREC-006` | `TEST-LEGACYREC-098`, `TEST-LEGACYREC-004`                       | `T-LEGACYREC-005` |
| `FR-LEGACYREC-005`  | `DES-LEGACYREC-001`, `DES-LEGACYREC-006` | `TEST-LEGACYREC-089`, `TEST-LEGACYREC-097`, `TEST-LEGACYREC-098` | `T-LEGACYREC-006` |
| `FR-LEGACYREC-006`  | `DES-LEGACYREC-008`                      | `TEST-LEGACYREC-006`                                             | `T-LEGACYREC-009` |
| `FR-LEGACYREC-007`  | `DES-LEGACYREC-008`, `DES-LEGACYREC-009` | `TEST-LEGACYREC-007`                                             | `T-LEGACYREC-010` |
| `FR-LEGACYREC-008`  | `DES-LEGACYREC-010`                      | `TEST-LEGACYREC-008`                                             | `T-LEGACYREC-011` |
| `FR-LEGACYREC-009`  | `DES-LEGACYREC-011`                      | `TEST-LEGACYREC-009`                                             | `T-LEGACYREC-013` |
| `NFR-LEGACYREC-001` | `DES-LEGACYREC-007`                      | `TEST-LEGACYREC-005`, `TEST-LEGACYREC-004`                       | `T-LEGACYREC-007` |
