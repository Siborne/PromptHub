# Storage Recovery Review Fixes Implementation

## Status

- Phase: converge
- Status: verified

## Shipped

- Restore journals now accept only the exact stage/prior paths derived from the
  operation identity; operation and artifact IDs also reject dot-segment path
  escapes, and recovery control paths reject symlinked ancestors.
- Root journals persist `includeSecrets` and reuse that policy during prepared
  rename recovery.
- Root overwrite and full restore use one resumable recovery-artifact publisher
  with durable `preparing` and `complete` manifests.
- Inventory traversal limits count directories and files. Retention removes
  invalid direct managed artifact directories while preserving protected IDs
  and refusing unsafe entry types.
- Added adversarial tests for interruption windows, identity conflicts, unsafe
  paths, symlinks, entry-type races, secret-bearing roots, and empty-directory
  inventories.

## Verification

- `TEST-STOREREC-001` through `TEST-STOREREC-003`: passed.
- Focused recovery coverage: 7 files, 139 tests; 100% statements, branches,
  functions, and lines across all 7 changed critical modules.
- Full storage-chain coverage: 18 files, 262 tests; 100% statements, branches,
  functions, and lines across all 18 storage modules.
- Core full suite: 51 files, 485 tests passed, including the 1,000-Prompt scale
  fixture (`elapsedMs=28813.0`, `incrementalMs=3380.8`,
  `maxRssDeltaKiB=3440`).
- Core typecheck: passed with `tsc --noEmit`.

## Analyze

- Traceability complete: yes.
- Conflicts/blockers resolved: no conflict with the archived storage design.

## Converge

- Stable recovery knowledge synced: yes.
- Issues/releases/ADRs: no state change required; these fixes complete the
  existing storage boundary without a public release-state transition.
- Spec index regeneration/check, governance, and traceability: passed.
- Final change destination:
  `spec/changes/archive/2026/08/2026-08-12-storage-recovery-review-fixes/`.

## Follow-ups

- The first package-manager invocation could not verify the configured pnpm
  release signature under restricted network access. Verification reran with
  the repository's approved installed pnpm fallback and passed.
- Repository-wide file-size lint remains blocked by an unrelated dirty test
  file (`agent-provider-profile-workbench.test.tsx`, 1,575 lines against its
  1,500-line preferred limit). Every source and test file in this change remains
  below its applicable hard limit.
- Desktop and browser E2E suites were not rerun because this change has no IPC,
  preload, route, or UI contract delta; the real-filesystem Core integration and
  full Core suites cover the changed ownership boundary.
