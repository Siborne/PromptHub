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
- Serialized programmatic `runCli` commands because runtime paths, database
  handles, and console suppression are process-global. CLI Vitest test-file
  parallelism is disabled for the same shared-process boundary; the
  filesystem-backed assertions remain unchanged.
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
- `TEST-VERIFY-005`: concurrent programmatic CLI commands use different data
  directories and each list only the Prompt created in its own directory.
- `TEST-VERIFY-006`: self-hosted desktop E2E fixtures use the production
  `web-backup-v2` snapshot identifier rather than scenario labels that the
  Web sync import contract correctly rejects.
- `TEST-VERIFY-007`: E2E settings helpers wait for the visible renderer before
  changing localStorage-backed settings, so an in-flight hydration write cannot
  overwrite a self-hosted sync configuration with defaults.
- `TEST-VERIFY-008`: the live self-hosted upload flow targets the visible
  backup and restore action names, derives managed rule/MCP/Plugin counts from
  desktop, and verifies the persisted remote snapshot rather than a stale
  historical inventory count.

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
- `pnpm --filter @prompthub/cli exec vitest run` passes all 9 files and 86
  tests, including `TEST-VERIFY-005`.
- Earlier full-profile attempts exposed the desktop entry bundle boundary, the
  Web route-test timeout budget, and an SSR shared-utils alias gap. Those
  issues were repaired without widening the product bundle budget or changing
  production behavior.
- `pnpm --filter @prompthub/desktop exec playwright test tests/e2e/self-hosted-sync.spec.ts --grep "automatically pulls the remote workspace"` passes (1 test). The previous E2E failure was a stale `startup-auto-sync` fixture label in the schema-version field; the server correctly rejected it as an unsupported backup version.
- The same E2E helper sequence was reproduced three times after the readiness
  barrier: each run retained `selfHostedSyncEnabled`, `syncProvider`, and the
  self-hosted URL after the language and settings reloads.
- `pnpm --filter @prompthub/desktop exec playwright test tests/e2e/self-hosted-sync.spec.ts --reporter=line` passes both startup pull and live manual upload/download scenarios (2 tests, 17.7 seconds). The manual flow verifies the current remote rule/MCP/Plugin inventory after upload.
- `pnpm verify:release` passed all 22 checks in 333.9 seconds: 86 CLI tests,
  2,859 desktop unit tests, 40 desktop integration tests, 6 desktop E2E smoke
  tests, 333 Web tests, and 10 Cloudflare worker tests.

## Synced Docs

- `spec/workflow/04-verification/README.md`
- `spec/rules/testing-standards.md`
- `spec/issues/active/quality.md`

## Follow-ups

- Triage the user-reported bugs into explicit regression tests and map each one to the lowest effective harness layer.
- Continue reducing existing React `act(...)` warnings so full-suite output is easier to audit.
