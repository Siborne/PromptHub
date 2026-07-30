# Implementation

## Current State

Implemented and converged. Automatic install/update scanning now resolves an
explicit policy while package integrity remains a non-optional main-process
boundary.

## Root Cause

- Store detail install and update paths called `skill:scanSafety`
  unconditionally.
- Quick install and some renderer update paths only read the global boolean.
- Main-process staged package handling always ran deterministic content
  preflight when the renderer omitted scan options.
- Settings had no channel or exact-store policy.

## Delivered Behavior

- Added a persisted global/channel/store policy with precedence
  `exact store > channel > global`.
- Added settings controls for five source channels, built-in stores, and custom
  stores. Overrides use `inherit`, `enabled`, or `disabled`.
- Bounded persisted exact-store policies to 512 normalized keys and rejected
  malformed channel/value input on both migration and normal rehydration.
- Added source-context recovery for later custom-store updates so a Gitea
  install remains associated with its exact store outside the current Store
  view.
- Threaded explicit `enabled`/`disabled` mode through quick install, detail,
  batch, update review, shared/core validation, preload/IPC, and main package
  lifecycle calls.
- Skipped renderer content scan, deterministic content preflight, and optional
  AI review only when the resolved policy is disabled.
- Preserved package materialization validation, including safe paths, archives,
  symlinks, limits, root `SKILL.md`, and fingerprint generation/approval.
- Kept manual safety scan actions unchanged.
- Added localized settings copy for all seven desktop locales.

## Verification Record

- `pnpm --filter @prompthub/core exec vitest run tests/skill-package-operation.test.ts`
  passed: 19 tests.
- Focused Desktop Skill Store, settings, source-update, package lifecycle, and
  validation regression run passed: 25 files / 278 tests.
- Desktop locale regression and renderer i18n smoke passed: 2 files / 9 tests.
- Pure policy resolver coverage passed at 100% statements, branches, functions,
  and lines.
- `pnpm --filter @prompthub/shared typecheck`,
  `pnpm --filter @prompthub/core typecheck`, and
  `pnpm --filter @prompthub/desktop typecheck` passed.
- All seven locale JSON files parsed successfully.
- `pnpm spec:test` passed all spec-init governance, submission scaffold,
  inventory, and single-source checks after archive.

The changed `disabled` main-process branch and the legacy enabled/missing-mode
paths are covered by focused service/lifecycle tests. The surrounding legacy
`skill-update-safety.ts` file remains at 71.55% line coverage and 75% branch
coverage; uncovered pre-existing provenance/reporting branches were not
expanded by this change.

## Stable Documentation Sync

Updated:

- `spec/knowledge/structure/skill-store-requirements.md`
- `spec/knowledge/reference/skill-regression-test-matrix.md`
- root and six localized repository-facing README safety descriptions

## Converge Status

Complete. Requirements, design, tests, implementation, stable Skill Store
behavior, regression matrix, and repository-facing documentation agree. The
change is ready for dated archive.
