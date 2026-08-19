# Implementation

## Status

Status: release-pending. Implementation is fully verified.
`v0.6.0-beta.1` remains withdrawn as a draft; the successful
replacement-candidate verification does not republish or retag the release.

## Implemented

- Replaced read-only durability handles with write-capable handles for SQLite
  safety images, raw recovery evidence, and newly staged canonical JSON files.
- Added Windows-handle regression tests for all three startup paths.
- Added `startup:window_ready` after the main window has loaded.
- Added a bounded packaged Windows x64 smoke that seeds a `0.5.9` profile,
  launches `win-unpacked/PromptHub.exe`, and requires both the upgrade snapshot
  and loaded-window startup events.
- Added the packaged smoke as a blocking Windows x64 release workflow step.
- Updated the stable release gate and withdrew the affected beta record.

## Verification

- Focused core regression: 16 tests passed.
- Focused desktop regressions and workflow contract: 40 tests passed.
- Core and desktop typechecks passed.
- Lint, file-size, spec traceability, and specification governance passed.
- CLI full suite passed: 123 tests.
- A staged-only isolated worktree passed every non-E2E check in the full local
  release harness. The self-hosted restore E2E exposed a pre-existing race where
  its one-second success toast could disappear before the post-click assertion
  started under load.
- The restore E2E now arms its success-state listener before clicking restore;
  the focused flow passed three consecutive runs and the complete built-artifact
  smoke passed all seven tests.
- Manual GitHub Actions run `31774646606` passed the full Linux verification job
  and reached the Windows x64 packaged smoke. The smoke failed before launching
  PromptHub because Node strip-types could not transform a parameter property in
  an imported package TypeScript source file.
- The smoke now seeds SQLite through the installed `node-sqlite3-wasm` runtime
  dependency instead of importing `packages/db/src/adapter.ts`. A regression
  test executes the script with Node strip-types and requires it to reach the
  non-Windows platform guard without syntax errors.
- Manual GitHub Actions run `31775706140` again passed the full Linux
  verification job and completed Windows x64 packaging. Its packaged process
  stayed alive, but the smoke timed out because changing the child `APPDATA`
  environment variable did not reliably change Electron's Windows Known Folder
  `appData` path; the script therefore seeded and watched a profile the app did
  not select.
- The packaged main process now accepts a release-smoke-only AppData override
  when, and only when, it is a packaged Windows CI process and the requested
  directory is strictly below `RUNNER_TEMP`. Electron receives that path before
  the unchanged normal data-path resolver runs. Invalid contexts and
  out-of-root paths fail closed.
- Failure output now includes a bounded isolated-profile inventory, any startup
  logs found there, and bounded child output before cleanup.
- Manual GitHub Actions run `31795386867` proved that Windows x64 completed the
  upgrade snapshot and loaded its renderer. The job then failed while removing
  its isolated root because Windows had not yet released a packaged-process
  handle.
- Cleanup now waits for the launched child close event and retries only the
  documented transient recursive-removal errors with a fixed budget. Persistent
  cleanup failures still fail the release job.
- The focused packaged-cleanup and workflow tests passed 20 tests. The cleanup
  helper reached 100% statement, branch, function, and line coverage; affected
  ESLint and change traceability also passed.
- The local quick release profile passed 28 of 29 checks. Its only failed check
  was specification index freshness caused by a separate uncommitted active
  change already present in the shared worktree; every code, type, lint, and
  test check completed successfully.
- Manual GitHub Actions run `31798130196` passed the full release verification
  and every build matrix job at commit `e1c0f5bc`. Windows x64 passed the real
  packaged `0.5.9` upgrade cold start, both Windows architectures uploaded
  artifacts, and both macOS architectures passed signing and notarization.
- The workflow was dispatched without a release tag, so its release job was
  intentionally skipped. The withdrawn GitHub release remains a draft pending
  a separate explicit publication decision.
- The AppData profile policy and release workflow wiring regressions passed 13
  focused tests; the wider data-path set passed 38 tests total, and desktop
  typecheck passed.
- The production desktop build, specification traceability validation, and the
  29-check quick release verification profile passed on the converged local
  code state.
- Manual GitHub Actions run `31778706137` reached the isolated Windows profile,
  completed the upgrade snapshot and layout migration, then exposed a second
  Windows-only startup failure: the desktop skill reconciliation marker was
  committed successfully, but an uncaught directory `fsync` returned `EPERM`.
- The marker publisher now keeps file durability mandatory while treating
  unsupported directory `fsync` as best effort, matching the repository's other
  atomic marker publishers. A regression reproduces the Windows error after
  rename and requires the committed marker to remain usable.
- The real Windows GitHub Actions runner remains required before release
  approval.

## Publication State

- No code or build-matrix blocker remains for this startup fix.
- On 2026-08-19 the maintainer explicitly authorized reusing and overwriting
  `v0.6.0-beta.1` instead of creating `beta.2`.
- The existing tag still points at the withdrawn candidate and the release
  remains a draft. They are intentionally preserved until the current dirty
  worktree is reduced to a clean, pushed candidate and the current quick/full
  plus platform gates pass.
- The pre-replacement remote baseline is recorded in
  `replacement-baseline.json`: annotated tag object, peeled commit, draft
  identity, and all 20 asset names, sizes, and GitHub SHA-256 digests.
- Candidate preflight repaired the only known Desktop-suite red state without
  weakening production code: `skill-ui.integration.test.tsx` now supplies the
  complete current Skill store contract (`registrySkills`, remote stores,
  registry loading, gallery columns, and pending child deployment state). Its
  focused integration suite passes 1 file / 11 tests; the prior seven failures
  all stopped at the stale mock before rendering.
- The complete Desktop Vitest suite now passes 610 files / 5,434 tests in
  664.42 seconds. Its stderr contains existing deprecation, React `act`, mock,
  jsdom navigation, and expected failure-path logs but no test failure. The
  delegated test process exited without leaving a Vitest worker.
- On the frozen replacement candidate, `pnpm verify:release:quick` passed all
  29 checks in 1,230.1 seconds and `pnpm verify:release` passed all 42 checks in
  796.3 seconds with zero failed or blocked checks. The full profile includes
  Core/Desktop performance budgets, four Desktop integration shards, Desktop
  build and bundle budget, built-artifact Electron smoke, CLI/Web builds,
  self-hosted Web smoke, Cloudflare dry-run build and Mobile checks.
- Release documentation is synchronized across the root and six translated
  user READMEs plus the website changelog. `docs/README.md` remains unchanged
  because it is only a documentation router. Website generated stable metadata
  and default downloads remain `0.5.9` as required for a beta.
- Isolated Agent config-files E2E passed and its screenshot confirms the gray
  file tree / white primary editor hierarchy. The broader Agent workspace E2E
  passed after its stale activation-button calls and non-waiting plan lookup
  were updated to the existing per-provider switch contract; production
  activation behavior was not relaxed. No matching public Agent screenshot
  exists, so unrelated stable screenshots were intentionally retained.
- `candidate-scope.md` freezes included replacement deltas, non-claims,
  worktree/sensitive-file audit results, verification state, and the remaining
  external mutation boundary.
- The repository workflow already refreshes an existing release in place,
  preserves its draft state, and uploads deterministic assets with `--clobber`.
  `TEST-WINSTART-007` locks this replacement path and passed with the complete
  release-workflow suite: 1 file / 8 tests. File-size governance, spec
  traceability, generated index and diff hygiene also passed. The leased tag
  update, replacement workflow run, asset verification and explicit promotion
  remain pending under `T-WINSTART-008`.
