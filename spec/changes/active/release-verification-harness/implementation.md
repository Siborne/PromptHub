# Implementation

## Shipped

- Added `scripts/verify-release.mts`.
- Added root scripts:
  - `pnpm verify:release`
  - `pnpm verify:release:quick`
- Added package-level `typecheck` scripts for `@prompthub/shared`, `@prompthub/db`, and `@prompthub/core`.
- Included `packages/shared/utils/**/*` in shared package typechecking because it is exported package surface.
- Added explicit Node type boundaries for `@prompthub/core` and `@prompthub/db`.
- Fixed a package-level typecheck bug in `packages/core/src/rules-workspace.ts` where `fileExists()` was used as a truthy Promise instead of being awaited.
- Stabilized real filesystem-backed CLI workspace sync tests with a 15-second
  budget. Assertions remain unchanged; the larger budget prevents a timed-out
  async import from resetting global runtime paths during the following test.
- Aligned heavy desktop component regressions with the established 30-second
  jsdom budget by removing stale local 10/15-second overrides.
- Bounded the desktop Vitest pool to two to four workers. This removes
  default-pool worker RPC starvation without weakening test assertions or
  individual test budgets.
- Updated the filesystem backup integration mock for the output-format export
  contract and corrected the prompt-card integration assertion to cover its
  role, focusability, and keyboard behavior.
- `TEST-VERIFY-003`: filesystem backup integration uses the current
  `listOutputFormatItems` renderer database export.
- `TEST-VERIFY-004`: prompt selection integration asserts the composite card's
  focusable keyboard contract instead of a native button-only attribute.

## Verification

- `pnpm verify:release -- --list` passes and shows the full release profile command list.
- `pnpm verify:release:quick -- --list` passes and shows only quick-profile checks.
- `pnpm --filter @prompthub/shared typecheck` passes.
- `pnpm --filter @prompthub/db typecheck` passes after adding the package's Node type boundary.
- `pnpm --filter @prompthub/core typecheck` passes after fixing the awaited file-exists check.
- `pnpm --filter @prompthub/cli exec vitest run tests/workspace-sync.test.ts --reporter=verbose` passes (1 file, 5 tests).
- `pnpm --filter @prompthub/desktop exec vitest run tests/unit/components/prompt-modal-structure.test.tsx --reporter=verbose` passes (1 file, 12 tests).
- The focused `SkillProjectsView` import-preference regression passes after using the shared desktop timeout budget.
- `pnpm verify:release:quick` passes all 18 checks in 596.8 seconds, including CLI tests/build, desktop lint/typecheck and 2,808 unit tests, web checks/build, and Cloudflare worker checks.
- A full `pnpm verify:release` run initially exposed default-pool desktop
  worker RPC timeouts and two stale desktop integration contracts.
- `pnpm --filter @prompthub/desktop exec vitest run tests/unit --maxWorkers=4 --minWorkers=2 --reporter=dot` passes all 288 files and 2,808 tests.
- `pnpm --filter @prompthub/desktop test:integration` passes all 7 files and 40 tests after the integration contract fixes.
- The final full `pnpm verify:release` rerun remains required before tagging.

## Synced Docs

- `spec/workflow/04-verification/README.md`
- `spec/rules/testing-standards.md`
- `spec/issues/active/quality.md`

## Follow-ups

- Triage the user-reported bugs into explicit regression tests and map each one to the lowest effective harness layer.
- Continue reducing existing React `act(...)` warnings so full-suite output is easier to audit.
