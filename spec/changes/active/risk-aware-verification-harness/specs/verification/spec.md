# Verification Harness Delta Spec

## Added Requirements

### `FR-HARNESS-001`: One executable verification registry

PromptHub MUST define verification checks, maintained surfaces, dependencies,
profiles, timeouts, and resource constraints in one executable registry used by
both local commands and CI.

#### Scenario: Local and CI inventories remain identical

- Given a check is added to the registry
- When the local runner lists checks and CI resolves its jobs
- Then both expose the same stable check id, command, profile, and dependency
- And no workflow maintains a competing copy of the command list

### `FR-HARNESS-002`: Safe affected-surface selection

The runner MUST select checks from changed paths and the transitive consumer
graph. Missing diff context, unknown paths, invalid path input, and changes to
the registry or root workspace configuration MUST fail safe to all surfaces in
the requested profile.

#### Scenario: Shared contract change fans out

- Given a file under `packages/shared/` changes
- When the changed profile is selected
- Then shared, database/core consumers, desktop, CLI, self-hosted Web,
  Cloudflare Worker, and mobile checks are selected as defined by the surface
  graph

#### Scenario: Unknown path cannot skip verification

- Given the changed-file input contains a path with no registered owner
- When the runner resolves affected checks
- Then it selects every surface for the requested profile
- And reports the unknown path that caused the safe fallback

### `FR-HARNESS-003`: Explicit risk-layer coverage

The registry MUST model governance, static analysis, unit, contract,
integration, security/adversarial, performance, build, E2E smoke, and packaging
as explicit layers. Every maintained product surface MUST declare which layers
apply and why an omitted layer is not applicable.

#### Scenario: Release inventory is complete

- Given the release profile
- When the registry is validated
- Then shared and core tests, database verification, CLI, desktop,
  self-hosted Web, Cloudflare Worker, mobile, governance, and build checks are
  present
- And required layers with no check cause registry validation to fail

### `FR-HARNESS-004`: Cross-boundary contracts are executable

Runtime schemas and serialized payloads that cross package, process, app, CLI,
or network boundaries MUST have a contract check that validates a producer
fixture with the real consumer validator or a shared runtime schema.

#### Scenario: Producer and consumer enum values diverge

- Given a producer emits a newly supported runtime enum value
- And a consumer still validates an older enum
- When the contract layer runs
- Then the contract check fails before build or publication

#### Scenario: Multiple UI entry points expose one action

- Given one user action appears in more than one visible entry point
- When its owning component or integration suite runs
- Then every entry point is verified against the same observable action
  contract

### `FR-HARNESS-005`: Bounded and recoverable execution

Every check MUST have a finite timeout. The runner MUST limit concurrency,
serialize checks that claim the same resource group, stop task-owned child
processes on timeout or interruption, wait for cleanup, and return a non-zero
exit status when a required check fails or is skipped because a dependency
failed.

#### Scenario: Check exceeds its budget

- Given a check starts child processes and exceeds its timeout
- When the runner cancels it
- Then the task-owned process group receives graceful termination
- And is forcibly terminated after the bounded grace period if necessary
- And the summary records a timeout rather than a generic failure
- And no task-owned process or port remains

#### Scenario: Independent checks can run concurrently

- Given two ready checks do not share a resource group
- When capacity is available
- Then they may run concurrently up to the configured limit
- But two checks sharing the same serial resource group never overlap

### `FR-HARNESS-006`: Deterministic results and traceability

The runner MUST print a deterministic human-readable summary and support an
optional JSON report. Active non-trivial changes MUST contain a complete
`FR -> DES -> TEST -> T` chain, and the governance gate MUST reject missing or
orphaned identifiers.

#### Scenario: Active change has an orphan requirement

- Given an active change declares an `FR-*` identifier without a mapped design,
  verification item, or task
- When governance verification runs
- Then the command fails and identifies the orphan chain

### `FR-HARNESS-007`: Build artifacts are reused

A profile MUST NOT rebuild the same surface artifact when a dependent check can
consume the artifact produced earlier in the same run.

#### Scenario: Desktop smoke follows desktop build

- Given desktop build and desktop E2E smoke are selected
- When the dependency graph executes
- Then the build runs once
- And the smoke check consumes that completed artifact

## Non-Functional Requirements

### `NFR-HARNESS-001`: Selection complexity

For `P` changed paths, `R` bounded path rules, `C` checks, and `E` dependency
edges, selection MUST remain `O(P * R + C + E)` time and `O(P + C + E)` space.
The registry MUST reject dependency cycles.

### `NFR-HARNESS-002`: Resource bounds

Local concurrency MUST default to no more than two child checks. CI MAY use a
higher explicitly configured bound, but no profile may use unbounded
concurrency. Optional report output MUST be bounded and MUST NOT include
credentials or complete sensitive environment values.

### `NFR-HARNESS-003`: Feedback performance

Before locking budgets, implementation MUST record three cold and three warm
runs for changed, quick, and release profiles on the baseline workstation or CI
runner. The quick-profile median MUST improve by at least 30% from the recorded
pre-change baseline without omitting required checks. Any regression above 15%
after normalization requires an explicit active-change note.

### `NFR-HARNESS-004`: Compatibility

Existing `pnpm verify:release` and `pnpm verify:release:quick` entry points MUST
remain available. Platform packaging verification MUST never publish, upload,
tag, or mutate a release.

## Modified Requirements

- Release readiness is no longer defined by a flat list of successful package
  commands. It requires a valid registry, complete applicable risk layers,
  successful transitive contract checks, and successful release-profile
  execution.
- Pull-request verification may select affected surfaces, but only through the
  same surface graph used by the local changed profile.

## Removed Requirements

- None.
