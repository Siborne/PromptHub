# Design

<!-- traceability: enforced -->

## Status

The design is ready for implementation. No production or harness behavior has
changed yet.

## Current Boundary

The archived `release-verification-harness` change remains the historical record
for the first root runner. This change extends that delivered boundary rather
than rewriting its archive.

Current verification has four independent inventories:

1. `scripts/verify-release.mts`
2. `.github/workflows/quality.yml`
3. self-hosted Web and Cloudflare Worker workflows
4. package-level scripts and active-change verification notes

The lists overlap but are not identical. The current root runner also has no
dependency graph, timeout contract, resource ownership, artifact reuse, or
structured result.

## Design Decisions

### `DES-HARNESS-001`: Typed registry with small ownership modules

`scripts/verify-release.mts` becomes a compatibility entry that delegates to
small modules under `scripts/verification/`:

```text
scripts/verification/
├── types.mts
├── surface-graph.mjs
├── checks.mts
├── select.mts
├── execute.mts
├── report.mts
├── cli.mts
└── tests/
```

- `surface-graph.mjs` owns path routing and transitive consumer relationships
  and remains directly importable by the plain-Node CI compatibility wrapper.
- `checks.mts` owns check metadata only.
- `select.mts` validates and selects the dependency closure.
- `execute.mts` owns process lifecycle, timeout, concurrency, and cleanup.
- `report.mts` owns bounded terminal and optional JSON output.
- `cli.mts` parses arguments and orchestrates selection and execution.

No module should exceed the project file-size limits. Selection and execution
remain independent so path routing can be tested without spawning processes.

The registry entry shape is:

```ts
type VerificationCheck = {
  id: string;
  label: string;
  surfaces: Surface[];
  layers: RiskLayer[];
  profiles: VerificationProfile[];
  command: {
    executable: string;
    args: string[];
    cwd?: string;
  };
  dependsOn?: string[];
  timeoutMs: number;
  resourceGroup?: ResourceGroup;
};
```

Commands use executable and argument arrays. Shell command strings are not
accepted. Check ids, exact commands, dependencies, profiles, timeout values,
surface ownership, and required-layer coverage are validated before execution.

### `DES-HARNESS-002`: One surface graph for local and CI selection

The graph contains:

- `governance`
- `shared`
- `database`
- `core`
- `cli`
- `desktop`
- `web-self-hosted`
- `web-cloudflare`
- `mobile`

Consumer fan-out is explicit:

- shared changes affect all package and application consumers;
- database changes affect core, CLI, desktop, and self-hosted Web;
- core changes affect CLI, desktop, and self-hosted Web;
- app-local changes affect only that app plus governance;
- workspace roots, lockfiles, setup actions, surface graph, or unknown paths
  affect every surface.

`scripts/detect-ci-surfaces.mjs` becomes a compatibility wrapper around this
graph during migration. CI obtains selected check ids from the runner's
machine-readable `--list --format json` output instead of maintaining another
command list.

Path input is data only. It is normalized as a repository-relative POSIX path,
rejected if it contains NUL, and never interpolated into a shell command.

Selection cost is `O(P * R + C + E)`, where the path-rule count is bounded by
the registry. Check and dependency metadata remain below 100 entries in the
first version, so a prefix-rule scan is simpler and cheaper to maintain than a
custom trie.

### `DES-HARNESS-003`: Four profiles with explicit semantics

| Profile   | Purpose                              | Included baseline                                                                                    |
| --------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `changed` | local and PR feedback                | governance plus affected static, unit, contract, and required build checks                           |
| `quick`   | repository-wide pre-commit diagnosis | all governance, static, unit, and contract checks; no E2E or packaging                               |
| `release` | release-candidate approval           | quick plus integration, security/adversarial, performance, builds, bundle budgets, and E2E smoke     |
| `package` | platform CI artifact proof           | release prerequisites plus platform-local installer/image/package creation, with publishing disabled |

Existing root commands map to `quick` and `release`. New commands may expose
`changed` and `package`, but `package` requires an explicit platform and cannot
upload artifacts.

The runner selects dependency closure after profile filtering. A required
dependency cannot be skipped because it belongs to a lower profile.

### `DES-HARNESS-004`: Risk-layer and contract gates

The first complete registry includes:

- governance: CI configuration, spec governance/index, and file-size limits;
- shared: typecheck, shared tests, and shared runtime-contract tests;
- database: typecheck and real SQLite schema/migration/reload tests;
- core: typecheck and core tests;
- CLI: lint, typecheck, tests, and build;
- desktop: lint, typecheck, unit, integration, performance, build, bundle
  budget, and built-artifact E2E smoke;
- self-hosted Web: lint, typecheck, tests, build, smoke, and Docker
  configuration/build proof where applicable;
- Cloudflare Worker: lint, typecheck, tests, and non-publishing build/dry-run
  proof where supported;
- mobile: typecheck and tests, with platform build proof owned by the package
  profile when a reproducible CI build is available.

Cross-boundary contracts follow ownership instead of creating a generic test
dump:

- runtime schemas shared by multiple packages live and are tested in
  `packages/shared`;
- database primitives and migrations are tested with real SQLite at the
  database boundary;
- producer-to-consumer sync payloads use a real producer fixture and consumer
  validator in the receiving app's contract suite;
- filesystem reconciliation remains in core or the owning main-process suite;
- UI action parity remains in the owning component/integration suite;
- native Plugin compatibility uses real package fixtures in the Plugin
  lifecycle suite.

Issues #190 through #193 receive product-specific active changes and regression
tests. This harness change only guarantees that their owning suites are selected
and cannot silently disappear.

### `DES-HARNESS-005`: Dependency-aware bounded executor

The runner validates the dependency graph and executes ready checks in
topological stages.

- Local concurrency defaults to `2`.
- CI concurrency may be configured up to a documented finite limit.
- Checks sharing a resource group are serialized.
- Initial serial resource groups are `sqlite-global`, `electron-runtime`,
  `network-port`, and `package-artifact`.
- A dependency failure marks downstream checks as blocked; independent ready
  checks already running are allowed to finish.
- No new checks are scheduled after interruption.

Every check has a timeout. On timeout or interruption, the runner:

1. sends graceful termination to the task-owned child process group;
2. waits up to a bounded five-second grace period;
3. forcibly terminates only that task-owned group if it is still alive;
4. waits for exit and records the final state.

The runner never kills processes by name and never touches a process that it did
not start. Windows and POSIX cleanup paths receive separate executor tests.

### `DES-HARNESS-006`: Build artifact reuse

Build checks produce logical artifacts consumed by dependent checks. The
registry models this through dependencies rather than a persistent artifact
cache.

For desktop:

- `desktop-build` produces `apps/desktop/out`;
- a new built-artifact smoke command consumes that output without invoking
  `pnpm build` again;
- the existing standalone E2E command may retain build-first behavior for
  direct developer use.

The same rule applies to Web client/server output and CLI packages. No local
test-result cache is introduced until invalidation and capacity policies are
specified.

### `DES-HARNESS-007`: SQLite template fixtures for normal-path suites

Suites that need a valid current schema but do not test migration create one
migrated, closed, immutable template database per suite or worker. Each test
copies that template into its own temporary directory.

- migration, recovery, lock, and concurrent-open tests always create their own
  uninitialized database and do not use the template;
- the template is closed before copying;
- each test owns its copied database and directory;
- afterEach/afterAll cleanup closes handles before deleting task-created files;
- fixture helpers expose no process-global mutable data directory;
- template capacity is bounded to one per worker and is released at suite end.

This removes repeated migration and backup I/O while preserving isolation.

### `DES-HARNESS-008`: Reports and executable traceability

Terminal output contains:

- selected profile and affected surfaces;
- ordered check id, status, duration, and failure category;
- blocked checks and their failed dependency;
- total wall time and maximum observed concurrency.

JSON output is opt-in through an explicit path. CI writes it under runner-owned
temporary storage and uploads it as an artifact. Reports include commands and
bounded diagnostic tails but exclude environment values and known secret
patterns.

The governance layer adds an active-change traceability validator. It checks the
existing Markdown artifact contract rather than inventing a second metadata
file:

- every declared `FR-*` and `NFR-*` has a mapped `DES-*`, `TEST-*`, and `T-*`;
- mapped identifiers exist in the active change;
- duplicate identifiers inside one active change fail;
- completed tasks cannot claim verification that is still marked pending;
- documentation-only and explicitly trivial changes may declare the existing
  documented exemption.

### `DES-HARNESS-009`: Performance measurement and budgets

Before changing concurrency or timeouts, implementation records:

- three cold and three warm runs for the existing quick and release profiles;
- per-check duration, total wall time, peak runner concurrency, and repeated
  build/migration counts;
- the same measurements after each optimization phase.

Optimization order:

1. remove duplicate builds and missing/duplicate aggregate invocations;
2. reuse migrated SQLite templates where semantically valid;
3. run independent package checks with concurrency `2`;
4. shard only suites proven to have no process-global state;
5. adjust worker counts from measured CPU and memory, not CPU count alone.

The selection algorithm is bounded by `O(P * R + C + E)` time and
`O(P + C + E)` memory. Child-process concurrency and report size are bounded.

## Failure Semantics

- Invalid registry, duplicate command, cycle, unknown dependency, missing
  timeout, or missing required layer: fail before spawning a child.
- Unknown changed path or missing base revision: select all surfaces and report
  the fallback.
- Check failure: block dependants, finish already-running independent work,
  return non-zero.
- Timeout: clean the owned process group, classify as timeout, return non-zero.
- Signal interruption: stop scheduling, clean all owned process groups, return
  the signal-appropriate non-zero status.
- Optional report write failure: verification results remain visible on stdout,
  but the run fails when a report path was explicitly requested.

## Security

- Changed paths and check metadata never enter a shell command string.
- Registry commands are repository-controlled executable/argument arrays.
- Environment forwarding uses an allowlist plus explicitly declared per-check
  test values.
- Reports redact secrets and never include full environment snapshots.
- Packaging profiles never publish, upload, tag, or use release credentials.

## Compatibility And Migration

1. Add registry validation and unit tests while keeping the old runner.
2. Reproduce the old quick/release inventory through the new runner.
3. Add missing checks and profiles.
4. Move CI surface selection and commands to registry output.
5. Remove the compatibility implementation after local and CI parity passes.

The public command names remain unchanged throughout the migration.

## Analyze Gate

- Requirements, design, verification, and tasks use a complete traceability
  chain.
- No product data source of truth changes.
- No new runtime dependency is required for the first implementation.
- The design extends rather than edits the archived first-generation harness.
- Product issue fixes remain in their owning changes, preventing this tooling
  change from becoming a mixed product refactor.
- The only remaining measurements are implementation-phase baselines; they do
  not block the design.

## Traceability

| Requirement       | Design                               | Verification                                               | Task                             |
| ----------------- | ------------------------------------ | ---------------------------------------------------------- | -------------------------------- |
| `FR-HARNESS-001`  | `DES-HARNESS-001`                    | `TEST-HARNESS-001`, `TEST-HARNESS-002`                     | `T-HARNESS-002`, `T-HARNESS-003` |
| `FR-HARNESS-002`  | `DES-HARNESS-002`                    | `TEST-HARNESS-003`, `TEST-HARNESS-004`                     | `T-HARNESS-004`                  |
| `FR-HARNESS-003`  | `DES-HARNESS-003`, `DES-HARNESS-004` | `TEST-HARNESS-005`, `TEST-HARNESS-006`                     | `T-HARNESS-005`, `T-HARNESS-006` |
| `FR-HARNESS-004`  | `DES-HARNESS-004`                    | `TEST-HARNESS-007`, `TEST-HARNESS-008`                     | `T-HARNESS-007`                  |
| `FR-HARNESS-005`  | `DES-HARNESS-005`                    | `TEST-HARNESS-009`, `TEST-HARNESS-010`, `TEST-HARNESS-011` | `T-HARNESS-008`                  |
| `FR-HARNESS-006`  | `DES-HARNESS-008`                    | `TEST-HARNESS-012`, `TEST-HARNESS-013`                     | `T-HARNESS-009`, `T-HARNESS-014` |
| `FR-HARNESS-007`  | `DES-HARNESS-006`                    | `TEST-HARNESS-014`                                         | `T-HARNESS-010`                  |
| `NFR-HARNESS-001` | `DES-HARNESS-002`, `DES-HARNESS-009` | `TEST-HARNESS-015`                                         | `T-HARNESS-011`                  |
| `NFR-HARNESS-002` | `DES-HARNESS-005`, `DES-HARNESS-008` | `TEST-HARNESS-010`, `TEST-HARNESS-016`                     | `T-HARNESS-008`, `T-HARNESS-009` |
| `NFR-HARNESS-003` | `DES-HARNESS-007`, `DES-HARNESS-009` | `TEST-HARNESS-017`                                         | `T-HARNESS-001`, `T-HARNESS-012` |
| `NFR-HARNESS-004` | `DES-HARNESS-003`, `DES-HARNESS-006` | `TEST-HARNESS-018`                                         | `T-HARNESS-013`                  |
