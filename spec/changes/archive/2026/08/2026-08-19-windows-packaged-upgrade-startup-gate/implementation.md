# Implementation

## Status

Status: completed and archived on 2026-08-19. The verified replacement was
published as the `v0.6.0-beta.1` GitHub Prerelease after the leased tag move,
platform matrix, artifact checks, and explicit promotion all completed.

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

## Publication State

- On 2026-08-19 the maintainer explicitly authorized reusing and overwriting
  `v0.6.0-beta.1` instead of creating `beta.2`.
- The pre-replacement remote baseline is preserved in
  `replacement-baseline.json`: annotated tag object, peeled commit, draft
  identity, and all 20 asset names, sizes, and GitHub SHA-256 digests.
- The annotated tag was moved with an expected-old-value lease. Its final tag
  object is `d665fc5e307f0dd7eb0413fe654784b87a6c13f8`, peeled to candidate commit
  `6c08b5e84d70ecb41b32030b00e2e04fae96319a`.
- Candidate preflight passed the complete Desktop Vitest suite: 610 files /
  5,434 tests. `pnpm verify:release:quick` passed 29/29 checks, and the final
  `pnpm verify:release` passed 42/42 checks with zero failed or blocked checks.
- Final Desktop Release run `32265536666` passed the full verification and all
  platform jobs. Windows x64 passed the real packaged `0.5.9` upgrade cold
  start; Windows arm64 packaging and both signed/notarized macOS architectures
  also passed.
- Release job `96116662419` merged the updater manifests, verified artifact
  hashes, and replaced all 20 assets with `--clobber` while preserving the
  draft boundary.
- After independent tag, asset, updater-manifest, GHCR, and stable Latest
  checks, the existing draft was explicitly promoted. Ten representative
  public asset URLs across Windows, macOS, Linux, CLI, and updater manifests
  returned HTTP 200.
- GitHub now exposes `v0.6.0-beta.1` as a public prerelease while stable
  `v0.5.9` remains Latest. No release task remains for this startup fix.
