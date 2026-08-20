# Implementation

## Status

Status: published. The bounded path and database lifecycle fixes are included
in the 2026-08-20 `v0.6.0-beta.1` same-version replacement.

## Reported Evidence

- Windows overwrite installation completed and the first launch opened
  normally.
- After a normal exit, the second launch displayed `Startup Error / 启动错误`.
- The error was `SQLite3Error: Could not open the database` for a canonical
  catalog stage ending in `.db.stage-<pid>-<uuid>`.
- The packaged Windows release smoke for `0.6.0-beta.1` verified only the first
  upgraded launch and therefore did not exercise canonical publication after
  renderer migration.

## Root Cause

Test-first confirmation captured the actual stage used for a long UUID-bearing
destination. The old stage basename was 194 characters because it duplicated
the destination and added another PID/UUID suffix. The bundled
`node-sqlite3-wasm` Windows VFS reports a 260-character maximum path. The
second launch is the first point at which an upgraded profile can enter this
canonical checkpoint path.

A repository-wide SQLite follow-up found that shortening only the leaf stage
was insufficient: the checkpoint directory stage still duplicated its long
target basename, so the complete path could remain over budget under the
deliberately long Windows release profile. The broader task-owned cleanup and
external-store handle findings are tracked separately in
`spec/changes/archive/2026/08/2026-08-20-database-resource-lifecycle-hardening/`.

## Implemented

- Canonical storage projection now assigns its verification database a bounded
  `.canonical-catalog-<full-uuid>.db` sibling instead of extending the full
  checkpoint name. Canonical Prompt catalog staging then uses
  `.catalog-stage-<full-uuid>.db`, also below 64 characters. Same-directory
  publication/rename, target-race refusal, quick-check, graph-hash, and SQLite
  sidecar cleanup are unchanged.
- Canonical startup now uses a bounded `.canonical-checkpoint-<uuid>` target,
  and checkpoint publication uses `.checkpoint-stage-<uuid>` instead of
  repeating the target basename. Under the deliberately long Windows release
  profile, the final verification, build-stage, and post-publication database
  lock paths model at 203, 199, and 204 characters rather than exceeding 260.
- The database-wide follow-up found that selected-database recovery still used
  `.canonical-recovery-checkpoint-<pid>-<uuid>`. Recovery now shares the bounded
  `.canonical-checkpoint-<uuid>` form, so the same path amplification cannot
  return outside normal startup.
- The packaged Windows smoke keeps one deliberately long runner-owned profile
  for two launches. The first launch requires the upgrade safety snapshot,
  `waiting-renderer-migration`, and `window_ready`; the second reads only newly
  appended events and requires canonical authority `published` plus
  `window_ready`.
- Release-smoke auto-exit is accepted only with the validated packaged Windows
  CI AppData override. Main-agent review found that `window_ready` can precede
  the renderer's persistence IPC and therefore must not independently trigger
  exit. The release profile now waits for both window readiness and successful
  durable renderer migration, then schedules normal `app.quit()` so the
  existing `before-quit` database cleanup runs. Forced task termination remains
  failure cleanup only.
- The Windows x64 release workflow still blocks artifact upload on the same
  script, now named as a two-launch upgrade smoke.
- Main-agent review reduced the deliberate long-profile segment so the legacy
  duplicated stage crosses the Windows budget while the new bounded stage
  remains below it. The release-only quit uses an event-driven two-signal
  barrier rather than a fixed delay or window-only trigger, preserving clean
  shutdown without adding idle time or racing the migration marker.

## Verification

The red-phase stage-path regression failed against the previous 194-character
basename.

- Core catalog regression: 1 file / 15 tests passed.
- Desktop release-smoke profile, workflow, and cleanup regressions: 3 files /
  34 tests passed before the final missing-`RUNNER_TEMP` branch addition; the
  final profile suite then passed 14/14 tests.
- Core and Desktop typechecks passed.
- Targeted Desktop ESLint, affected-file Prettier, file-size governance, spec
  governance/traceability, and whitespace checks passed.
- `release-smoke-profile.ts` reached 100% statement, branch, function, and line
  coverage.
- Focused coverage for `prompt-canonical-catalog.ts` reached 98.44% statements
  and lines, 97.59% branches, and 100% functions. The only uncovered legacy
  lines are the pre-existing parent-missing and cycle guards in
  `orderParentsFirst`; canonical graph validation rejects those shapes before
  that internal ordering helper. The new stage naming and all changed branches
  are covered.
- The packaged two-launch smoke cannot run on this non-Windows host. A real
  Windows x64 release runner supplied the final platform evidence.
- `pnpm verify:release:quick` passed all 29 checks with zero failed or blocked
  checks in 1,016.5 seconds at maximum concurrency two. The delegated runner
  left no Vitest, pnpm, verification process, or service port behind.
- A Windows-path budget model using the GitHub-hosted runner prefix
  `D:\a\_temp` showed that a leaf-only fix still left verification/catalog
  paths at 264-268 characters because the checkpoint directory stage repeated
  its target. Bounding the ancestor and leaf names reduces the final database
  paths to 194-199 characters and `.lock` paths to 199-204. This is static path
  evidence, not a substitute for the pending Windows execution.
- After the database-wide review, the final focused candidate passed Core 47/47
  tests and Desktop 121/121 tests across release smoke, canonical publication,
  recovery, safety points, and affected external database adapters. DB, Core,
  and Desktop typechecks plus targeted Desktop ESLint passed.
- The final selected-database recovery checkpoint regression passed 6/6 tests;
  Desktop typecheck, focused ESLint, spec governance, and formatting passed
  after the recovery-only ancestor was shortened.
- Final isolated candidate `ae5e923f447575f3222693fb3da943d874270ace`
  passed `pnpm verify:release` 42/42 in 550.8 seconds.
- Manual full-platform run `32355673880` passed. Windows x64 proved both the
  first `waiting-renderer-migration` / `migrated` launch and the second
  `published` / `already-complete` launch against the same profile; release was
  skipped because the run had no tag.
- Tag run `32357771862` passed all platform, signing, notarization, two-launch,
  manifest, asset, and release jobs. Annotated tag object
  `28bea7d43a0faf5bdc1280de6d8d72660a777063` peels to the final candidate.
- The published release remains non-draft Prerelease with 20 refreshed assets;
  the Windows x64 installer digest is
  `sha256:8b24f4600b0cb8ee14d5e4637b03532e9e372f97832a222f382612a26bb4f390`.
- The release-smoke lifecycle helper reached 100% statement, branch, function,
  and line coverage. Core canonical path/cleanup coverage reached 99.52%
  statements/lines, 98.37% branches, and 100% functions across the two touched
  modules; remaining uncovered guards are unchanged legacy validation paths.
