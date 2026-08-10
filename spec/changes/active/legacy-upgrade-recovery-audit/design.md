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
| `NFR-LEGACYREC-001` | `DES-LEGACYREC-007`                      | `TEST-LEGACYREC-005`, `TEST-LEGACYREC-004`                       | `T-LEGACYREC-007` |
