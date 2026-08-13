# PromptHub 0.6.0-beta.1 Readiness Implementation

## Status

- Phase: converge
- Status: published

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
- Signed/notarized artifact verification was completed by the tag-triggered
  release workflow before publication.

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
- Hosted Linux Electron launch and the complete release profile were then
  exercised by the replacement tag-triggered workflows.
- Replacement run `31708660993` passed 41 of 42 full release checks. Its Linux
  Electron smoke launched and passed four scenarios; three settings scenarios
  then failed because the headless runner had no desktop keyring for Electron
  `safeStorage`. Linux CI E2E now opts into Chromium's basic test password
  store and Electron's documented in-memory encryption fallback after app
  readiness, while production launch and production secret-vault behavior
  remain unchanged.

## Publication Evidence

- Candidate commit: `2ed96c7f23da512bb41a3081ca4c198df483b2ba`.
- Final tag-triggered run `31712011544` completed successfully:
  https://github.com/legeling/PromptHub/actions/runs/31712011544
- The verify job and Linux, Windows x64, Windows arm64, macOS arm64, macOS x64,
  and release jobs all passed.
- Both macOS matrix jobs passed architecture, Developer ID signing,
  notarization, stapling, and Gatekeeper verification.
- The draft prerelease contained 20 required installers, archives, blockmaps,
  update manifests, and CLI assets before promotion.
- The public prerelease was published on 2026-08-13 and was not promoted to
  Latest: https://github.com/legeling/PromptHub/releases/tag/v0.6.0-beta.1

## Convergence

- `CHANGELOG.md` and the structured release record now identify the beta as
  published rather than an unreleased candidate.
- Stable-facing `0.5.9` downloads and update behavior remain unchanged.
- The completed change is ready for the dated archive.
