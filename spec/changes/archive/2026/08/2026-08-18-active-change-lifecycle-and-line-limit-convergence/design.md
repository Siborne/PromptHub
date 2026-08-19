# Lifecycle And Line-Limit Convergence Design

## `DES-CONVERGE-001`: Lifecycle Decision Matrix

Completed-change archive eligibility requires implementation evidence,
verification evidence, stable-doc synchronization or an explicit statement that
none is required, completed convergence, no dirty files owned by the change,
and no remaining review, release, publication, or user-decision gate. Open
checkboxes must be reconciled rather than counted mechanically. Deferred,
abandoned, or superseded design records may also leave active after their
remaining scope is routed to an issue/roadmap and their disposition is explicit.

The audit is linear in the number of change documents and task markers,
`O(C + T)`, and performs no network work.

## `DES-CONVERGE-002`: Archive Publication

Eligible directories move to
`spec/changes/archive/2026/08/2026-08-18-<change-key>/`. Historical content and
names remain unchanged. The generated inventory is refreshed only after all
moves and lifecycle corrections are complete.

## `DES-CONVERGE-003`: Responsibility-Based Source Splits

- Keep existing public entry files as compatibility facades where callers
  already depend on them.
- Extract cohesive transport, model-discovery, image-generation, UI section,
  recovery/data-path, MCP policy, or injector-operation responsibilities into
  sibling modules owned by the same package and process layer.
- Preserve import direction: renderer helpers remain in renderer, Electron
  orchestration remains in main, and shared Core code does not import app code.
- Prefer pure props/helpers for UI extraction and injected dependencies for
  side-effectful orchestration.

Code motion does not change the algorithms: inventory remains `O(n)` in the
same input sets, streaming and hashing remain bounded, and no additional file,
database, or network pass is introduced.

The CLI test split remains test-only: Rules import/validation coverage moves out
of the general router suite and the shared-global-target lifecycle moves out of
the general Skill suite. The Prompt workspace split moves restore-marker path,
write, existence, and cleanup operations into a sibling module while the
existing entry file re-exports `writeRestoreMarker`; it does not introduce a
second parser, traversal, or storage owner.

## `DES-CONVERGE-004`: Verification Boundary

Existing behavior tests serve as the refactor protection layer. The file-size
baseline is reduced in the same implementation batch so the static gate proves
the old monolith cannot regrow. Focused tests run first after the complete code
and documentation batch, followed by affected typechecks and the changed-risk
release harness.

## `DES-CONVERGE-005`: Remote Release Evidence

Use read-only GitHub release metadata for lifecycle classification. A local tag
does not prove publication. `isDraft`, `isPrerelease`, the public URL, asset
inventory, and current Latest stable release are recorded without mutating the
remote repository.
