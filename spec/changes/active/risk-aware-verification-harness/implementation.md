# Implementation

## Status

Implementation is locally complete for the registry, selection, executor,
reporting, CI command ownership, built-artifact smoke boundary, traceability
validation, and self-hosted Web SQLite fixture optimization. Release and
platform package execution remain CI/release-candidate gates.

## Delivered

- Replaced the flat sequential root runner with a typed registry and small
  selection, execution, reporting, and CLI ownership modules under
  `scripts/verification/`.
- Added `changed`, `quick`, `release`, and non-publishing single-surface
  `package` profiles while preserving `pnpm verify:release` and
  `pnpm verify:release:quick`.
- Added complete-inventory validation for ids, commands, profiles, surfaces,
  layers, dependencies, cycles, timeouts, resource groups, and required
  surface risk layers.
- Added safe changed-path routing with shared/db/core consumer fan-out and
  all-surface fallback for unknown, malformed, or unavailable diff input.
- Added bounded topological execution with default concurrency 2, serial
  resource groups, per-check timeouts, dependency blocking, signal handling,
  POSIX task-owned process-group cleanup, bounded output, and secret redaction.
- Migrated quality, self-hosted Web, and Cloudflare Worker CI commands to select
  the same registry rather than duplicate package command lists.
- Split desktop build-first E2E from built-artifact smoke and added
  non-publishing CLI/Desktop package proof plus Worker dry-run build proof.
- Added an incremental active-change traceability validator. New templates carry
  `<!-- traceability: enforced -->`; legacy active changes without the marker
  remain migration debt rather than blocking unrelated delivery.
- Added one closed, current-schema SQLite template in self-hosted Web global
  setup. Normal tests copy it into isolated data roots; recovery-specific tests
  retain their own explicit preconditions.
- Registered existing real sync import/route contract suites under the
  self-hosted Web contract layer instead of creating a generic duplicate suite.

## Verification

- `pnpm test:verification-harness`: 15 tests passed.
- `node --test scripts/validate-change-traceability.test.mjs`: 3 tests passed.
- `pnpm spec:traceability`: passed for the enforced active change.
- `pnpm test:ci-config`: 6 tests passed.
- `pnpm --filter @prompthub/web typecheck`: passed.
- `pnpm --filter @prompthub/web lint`: passed.
- Focused database template and orphan-lock recovery tests: 3 tests passed.
- `pnpm --filter @prompthub/web test`: 61 files / 369 tests passed; Vitest
  duration 20.94 seconds, wall time 21.84 seconds.
- `ruby` YAML parsing passed for `quality.yml`, `web-self-hosted.yml`, and
  `web-cloudflare.yml`.
- `pnpm spec:test` and `pnpm spec:index:check`: passed.
- `git diff --check`: passed after the final documentation convergence edits.
- Resource cleanup: no verification runner, Vitest process, temporary database
  template, or temporary JSON report was retained.

## Measurements

The pre-change quick runner completed 18 sequential checks in 560.02 seconds.
The first registry run, before the Web template optimization, completed its
expanded 22-check inventory in 465.12 seconds. The post-template run completed
the same 22-check inventory in 334.47 seconds, a 40.3% wall-time reduction from
the fresh pre-change baseline.

| Measurement                    |                    Before |                After |
| ------------------------------ | ------------------------: | -------------------: |
| Root quick wall time           |                  560.02 s |             334.47 s |
| Root quick maximum concurrency |                         1 |                    2 |
| Web suite standalone wall time | about 153.1 s in baseline |              21.84 s |
| Web test inventory             |      60 files / 367 tests | 61 files / 369 tests |
| Desktop unit during root quick |          297.6 s baseline |              294.3 s |

The initial parallel run made Web and Desktop contend for CPU and increased
Desktop unit time to 427.9 seconds. Removing repeated Web schema/migration work
reduced the overlap enough for Desktop to return to its baseline duration.
Selection over 10,000 known paths completed below the one-second test budget
(about 15-19 ms on the baseline workstation).

Only one fresh pre-change and two post-change phase measurements were run. The
planned three cold/three warm matrix was not completed because each historical
profile run consumes roughly 5-10 minutes and the worktree contains unrelated
active changes. The measured improvement exceeds the 30% target, but a CI
median remains the release acceptance source.

## Remaining Risks

- The root quick run still exits non-zero on the pre-existing file-size debt in
  `SkillStore.tsx` and `SkillStoreDetail.tsx` (1,536 lines each versus the
  preferred 1,500-line gate). All other selected checks passed in the measured
  run.
- Windows child-tree cleanup still needs proof on a Windows CI runner; the local
  regression proves POSIX process-group cleanup, including a spawned
  grandchild.
- The complete release profile, Worker dry-run build, desktop E2E, and platform
  package profiles were not run locally. They remain bounded CI/release gates
  and do not publish.
- Traceability enforcement is marker-based during migration. Legacy active
  changes without the marker are not yet rejected; all newly generated change
  templates opt in.
- The Web template path is used only while `VITEST` is set, copies only into a
  missing database path, and is removed by global teardown. Future migration or
  recovery tests must continue to create explicit database preconditions.
- Product issues #190 through #193 still require separate product changes and
  regression tests.
