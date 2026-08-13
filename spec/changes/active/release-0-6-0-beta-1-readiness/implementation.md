# PromptHub 0.6.0-beta.1 Readiness Implementation

## Status

- Phase: converge
- Status: local-gates-passed

## Baseline Audit

- All shipped manifests currently report `0.6.0`, which is not a valid beta
  identity under the release rules.
- `pnpm verify:release:quick` failed file-size, Core performance, CLI runtime,
  Worker authentication timeout, and Desktop unit timeout checks.
- The worktree contains uncommitted and untracked release inputs.
- No `0.6.0-beta.1` artifact or remote tag exists.

## Verification

- Node `24.9.0`: `pnpm verify:release:quick` passed 29/29 checks in 446.1s.
- Node `24.9.0`: `pnpm verify:release` passed 42/42 checks in 717.5s,
  including Core storage performance, CLI and Desktop builds, eight Desktop
  unit shards, four Desktop integration shards, built-artifact Electron E2E,
  self-hosted Web build/smoke, Worker dry-run, and Mobile checks.
- Focused verification also passed the canonical Rule reconciliation test,
  58 Desktop Rule/settings regressions, the self-hosted startup E2E scenario,
  the full 123-test CLI suite, source-size governance, and Desktop build.
- Signed/notarized artifact verification remains pending because no candidate
  artifacts have been built.

## First CI Attempt

- Release run `31704219084` failed in the verify job before packaging.
- Specification governance could not see the ignored release-domain delta
  spec; Web tests had no collection-time `JWT_SECRET`; three Desktop tests
  inherited the Linux runner platform; and Electron E2E could not launch the
  Chromium sandbox on the hosted Linux runner.
- The failed run produced no release artifacts and no public GitHub Release.

## CI Repair Verification

- `pnpm spec:test` passed traceability validation for 24 active changes.
- Focused Desktop verification passed 56 tests covering Linux CI Electron
  launch arguments and the three platform-specific assertion repairs.
- Self-hosted Web verification passed 69 files and 413 tests with the
  release-only JWT secret; the verification harness passed 22 tests.
- The quick profile passed 28 of 29 checks. Its only failure was the Web
  inventory timing assertion under concurrent gate load; the assertion now
  measures cold inventory construction and cached lookup separately, and its
  focused four-test suite passes.
- Hosted Linux Electron launch and the complete release profile remain for the
  replacement tag-triggered workflow to prove.
- Replacement run `31708660993` passed 41 of 42 full release checks. Its Linux
  Electron smoke launched and passed four scenarios; three settings scenarios
  then failed because the headless runner had no desktop keyring for Electron
  `safeStorage`. Linux CI E2E now opts into Chromium's basic test password
  store and Electron's documented in-memory encryption fallback after app
  readiness, while production launch and production secret-vault behavior
  remain unchanged.

## Remaining Publication Boundary

- `T-BETA1-006` remains open: the current worktree must be reviewed and turned
  into an intentional candidate commit before tagging.
- Tag-triggered CI must produce the macOS, Windows, and Linux artifacts and
  verify signing, notarization, stapling, Gatekeeper, update manifests, and
  draft-prerelease assets before public promotion.
