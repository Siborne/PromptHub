# Implementation

## Status

Status: release-pending. The repository-wide database audit, implementation,
focused tests, typechecks, lint, and changed-behavior coverage are complete.
The clean full release harness and real packaged Windows two-launch gate remain
pending, so publication is not yet claimed.

## Audit Evidence

- `node-sqlite3-wasm@0.8.53` reports a 260-character Windows VFS path limit and
  implements writer locking as an adjacent `<database>.lock` directory.
- The canonical checkpoint directory stage duplicated its long target basename,
  so bounded leaf filenames alone did not keep the complete SQLite path within
  budget.
- Task-owned database cleanup loops omitted `.lock` in Core, DB, and Desktop
  failure paths.
- Cherry Studio and Hermes could leak an opened connection during schema
  validation; Cherry Skill could leak when table probing threw; NanoClaw could
  leak its inbound handle if the outbound database failed to open.
- The 53 discovered production SQLite transaction call sites contain no async
  callbacks. Main database lease, migration-intent, integrity, and normal
  shutdown ownership were consistent with stable database-concurrency rules.

## Implemented

- Added `packages/db/src/owned-temporary-database.ts` as the single primitive
  for validated `.<label>-<uuid>.db` names and cleanup of the database,
  rollback/WAL sidecars, and adjacent `.lock` directory. Cleanup leaves
  `.clients`, unrelated siblings, and an external symlink target untouched.
- Adopted bounded names and complete cleanup in Prompt canonical catalog,
  complete canonical shadow, checkpoint verification/snapshot, canonical
  projector, catalog self-heal, file-authoritative recovery, and consistent
  safety-point image failure paths.
- Canonical startup now uses `.canonical-checkpoint-<uuid>` and checkpoint
  construction uses `.checkpoint-stage-<uuid>`, removing the long duplicated
  ancestor that still put a short SQLite leaf over the Windows budget.
- Cherry Studio and Hermes close stores rejected during schema validation;
  Cherry Skill closes capability-probe failures; NanoClaw closes its inbound
  database when its paired outbound database cannot open.
- File-authoritative Prompt recovery now closes once, always removes owned
  artifacts on failure, preserves the original operation error when close also
  fails, and rejects a successful result when close fails.

## Verification

- Core focused behavior: 3 files / 47 tests passed.
- Desktop release/canonical/recovery/session behavior: 15 files / 121 tests
  passed; the release-profile suite later passed 22/22 after setup-level
  coverage was added.
- DB, Core, and Desktop typechecks passed. Targeted Desktop ESLint passed.
- `release-smoke-profile.ts` reached 100% statements, branches, functions, and
  lines.
- Core canonical coverage reached 99.52% statements/lines, 98.37% branches,
  and 100% functions across the two touched modules. The only Prompt catalog
  gaps are pre-existing parent-missing/cycle guards already rejected by graph
  validation; the changed path/cleanup branches ran.
- Focused Desktop database lifecycle coverage ran 10 files / 71 tests and
  exercised each new path/cleanup/close branch. Aggregate legacy-file coverage
  was 90.02% statements/lines and 74.01% branches; every added failure branch
  has a direct regression.
- The database helper has 10 boundary/security tests covering maximum label,
  unsafe labels, every owned sidecar, `.lock`, `.clients`, unrelated siblings,
  and lock-symlink target preservation. Vitest's Core-root V8 provider does not
  instrument source outside `packages/core`, so it reported 0 files for that
  cross-package helper despite all 10 tests executing; this tooling limitation
  is recorded rather than presented as numeric coverage.
- Static Windows modeling with the release smoke's long root puts final
  verification/catalog-stage/post-publication verify paths at 198/194/199
  characters and their `.lock` paths at 203/199/204, respectively. The real
  Windows packaged run remains the authoritative platform gate.
- The current shared worktree line-limit command is blocked by unrelated,
  pre-existing Rules work above its legacy baselines. The release candidate
  will run the complete line and release gates from an isolated clean worktree
  containing only committed release changes.
