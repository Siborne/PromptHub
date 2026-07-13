# Implementation Record

## Status

- Phase: implement
- Status: Desktop review-flow slice verified; canonical main-process lifecycle
  remains pending

## Current Evidence

- The escaped Gitea regression was written first and reproduced the raw
  `SAFETY_REVIEW_REQUIRED` failure before production code changed.
- First install now returns a discriminated result and preserves the staged
  package review, findings, exact source key, and package fingerprint.
- The complete Desktop suite passes 349 test files and 2,955 tests, including
  real temporary Git repository creation, commit, clone, nested-file,
  symlink-exclusion, cleanup, and large-inventory coverage.
- First install still creates then compensates a temporary DB row. The planned
  main-process stage-before-row lifecycle and startup staging cleanup are not
  yet implemented, so this change remains active.

## Shipped

- Added `RegistrySkillInstallResult` and fingerprint approval options to the
  shared Skill contract and migrated every renderer install caller.
- Added shared renderer controllers for install reviews and batch update
  reviews. Approval retries are fingerprint-pinned, duplicate confirmation is
  guarded, and exact-source trust is persisted only after success.
- Store detail, quick install, batch install, batch update, and Git/Gitea import
  now open or queue authoritative package review instead of showing a raw
  failure. Batch summaries report review-required items separately.
- Raw content URL updates now return the same reviewable high-risk outcome as
  staged Git/Zip packages. Non-overridable blocked findings remain blocked.
- Temporary install-row rollback is checked. A failed rollback returns
  `ROLLBACK_INCOMPLETE` and does not expose a misleading resumable review.
- Extracted Store filters, overlays, presentation helpers, and operation
  controllers. `SkillStore.tsx` is 1,496 lines and `SkillStoreDetail.tsx` is
  1,486 lines; no changed Skill file exceeds the preferred 1,500-line target.
- Added localized install-review and review-queue copy for all seven locales.
- Replaced the My Skills slug-keyed update badge Map with a pure source-ranked
  selector. Same-slug variants from other stores can no longer overwrite the
  installed Skill's candidate; legacy slug fallback is unique-only, and
  incompatible fingerprint algorithms are never compared.

## Verification

- `TEST-SIL-002`: passed. The reported Gitea first-install path opens the
  authoritative review and completes after exact-fingerprint approval.
- `TEST-SIL-003`: passed for fingerprint change and trust-after-success. Trust
  is not persisted for a changed or failed package.
- `TEST-SIL-004`: passed for renderer-store DB-row compensation and explicit
  rollback failure; main-process stage-before-row and crash cleanup remain
  pending.
- `TEST-SIL-005`: passed for Store detail, quick/batch flows, Git import, and
  My Skills update-badge rendering. A newly installed same-slug collision no
  longer renders an update badge, while exact-source version/fingerprint
  changes still do; installed-Skill detail still uses the existing update
  controller.
- `TEST-SIL-008`: passed for Git/Gitea package and content URL review behavior;
  full lifecycle adapter consolidation remains pending.
- Commands completed:
  - `pnpm --filter @prompthub/desktop typecheck`
  - install/update focused Vitest regression: 9 files, 103 tests
  - update-badge and legacy-state regression: 4 files, 32 tests
  - `pnpm test:run`: 349 files, 2,955 tests
  - new review controller coverage: 100% statements, branches, functions, and
    lines
  - new library update-badge selector coverage: 100% statements, branches,
    functions, and lines
  - `pnpm --filter @prompthub/desktop lint`
  - `pnpm verify:release:quick`: all 18 stages passed in 409.8 seconds
  - `pnpm spec:test`, `pnpm spec:index`, and `pnpm spec:index:check`
- `pnpm lint:file-size` is blocked only by the parallel MCP/ZCode worktree
  change in `packages/core/src/mcp-library.ts` at 1,920 lines versus its 1,914
  legacy baseline. The Skill files changed here remain below 1,500 lines.
- Pending before archive: main-process lifecycle migration, stage-before-row
  apply, crash cleanup, concurrency/idempotency, full adapter consolidation,
  and a clean repository-wide file-size gate after the unrelated MCP change is
  resolved.

## Analyze

- Traceability complete: yes, for `FR-SIL-001` through `FR-SIL-010`.
- Conflicts/blockers resolved: yes. The new change extends, rather than
  contradicts, the archived update-only trust review contract.
- Remaining architecture gap: `DES-SIL-002`, `DES-SIL-003`, `DES-SIL-005`, and
  `DES-SIL-008` are not complete. The current slice fixes all known Desktop
  entry-point behavior without claiming the main-process lifecycle migration.

## Converge

- Stable Skill behavior and the regression matrix are synced for the shipped
  review flow.
- Issues/releases/ADRs remain unchanged because the lifecycle consolidation is
  active and no release is being published in this change.
- Change index is regenerated and checked after the final verification pass.
- Final destination:
  `spec/changes/archive/<YYYY>/<MM>/<YYYY-MM-DD>-skill-install-update-lifecycle-contract/`

## Follow-ups

- Reuse the shared/core lifecycle contract for CLI and Web adapters only after
  the Desktop acceptance gate passes; do not broaden this change by silently
  changing their user interaction model.
