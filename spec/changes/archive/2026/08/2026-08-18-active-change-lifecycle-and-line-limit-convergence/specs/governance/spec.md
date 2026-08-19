# Spec Delta: Lifecycle And Line-Limit Convergence

## Added Requirements

### `FR-CONVERGE-001`: Complete active-change classification

Every change under `spec/changes/active/` MUST be classified from recorded
tasks, implementation, verification, synchronization, convergence, blockers,
release conditions, and current worktree state. Checkbox completion alone MUST
NOT establish archive eligibility.

### `FR-CONVERGE-002`: Truthful lifecycle destination

A locally complete and converged change MUST move to the dated archive. A
change with unfinished work, an unresolved review condition, a release gate, or
an implementation/documentation discrepancy MUST remain active with a truthful
exit condition.

### `FR-CONVERGE-003`: One-way large-file reduction

Governed legacy source files above the 1,500-line preferred ceiling MUST be
split by responsibility until they fit the normal ceiling or a documented
runtime packaging constraint proves that a smaller standalone file is unsafe.
No extracted file may exceed the 1,000-line default without a recorded reason.

### `NFR-CONVERGE-001`: Behavior and resource preservation

The refactor MUST preserve exports, process/port behavior, persistence, network
request count, runtime complexity, and resource cleanup. It MUST NOT start a
long-running service or mutate user data.

### `FR-CONVERGE-004`: Prevent hotspot regression after archival

Files split by a completed change MUST NOT silently regrow past that change's
recorded default target. When later work pushes a test or source file beyond
1,000 lines without a documented reason, the lifecycle audit MUST either split
the new responsibility or open an explicit debt record; an archived statement
that the file remains below 1,000 lines must not be left unqualified.

### `FR-CONVERGE-005`: Verify publication gates from remote evidence

Release-gated changes MUST be classified from the current GitHub release state,
not only from local tags or release prose. Draft, prerelease, and published
stable states remain distinct.

## Acceptance And Verification

- `TEST-CONVERGE-001`: generated change inventory and lifecycle audit agree on
  active/archive counts and destinations.
- `TEST-CONVERGE-002`: spec governance, index, and traceability checks pass.
- `TEST-CONVERGE-003`: file-size gate passes after obsolete legacy baselines are
  removed or lowered; every new extracted file stays below 1,000 lines.
- `TEST-CONVERGE-004`: focused unit/integration tests for every moved code
  responsibility pass through the unchanged public entry points.
- `TEST-CONVERGE-005`: affected typechecks, lint, formatting/diff checks, and
  the risk-selected release profile pass.
- `TEST-CONVERGE-006`: the CLI suite passes after test ownership is split and
  both affected CLI test files remain below 1,000 lines.
- `TEST-CONVERGE-007`: GitHub release metadata is recorded for `v0.5.9` and
  `v0.6.0-beta.1`, including draft/prerelease state and remaining publication
  actions.
