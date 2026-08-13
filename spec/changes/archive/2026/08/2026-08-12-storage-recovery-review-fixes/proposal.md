# Storage Recovery Review Fixes Proposal

## Phase And Status

- Phase: converge
- Status: verified
- Primary requirement: `FR-STOREREC-001`
- Exit condition: reviewed recovery paths cannot delete non-owned data, lose the
  prior recovery set, bypass inventory bounds, or hide invalid artifacts.

## Why

The post-convergence review found five gaps in the local storage recovery
boundary: journal paths were only root-contained rather than operation-owned,
artifact publication had a crash window after moving prior data, recovery digest
comparison omitted secrets, inventory limits counted files but not directories,
and invalid artifacts disappeared from retention accounting.

## Scope

- In scope: Core root migration, full restore, recovery registry, inventory, and
  their adversarial filesystem tests.
- Out of scope: Cloud transport behavior, UI changes, and unrelated Agent work.

## Risks

- Incorrect recovery logic can delete active data or strand the only prior set.
- Cleanup of invalid artifacts must never follow symlinks or paths outside the
  managed recovery root.

## Rollback Thinking

The fix is isolated to journal validation, resumable artifact publication,
inventory metadata, and registry cleanup. Reverting the commit restores the
previous behavior without changing resource schemas.

## Related Records

- Predecessor: `spec/changes/archive/2026/08/2026-08-12-database-migration-safety`
- Stable knowledge: `spec/knowledge/behavior/data-recovery.md`
