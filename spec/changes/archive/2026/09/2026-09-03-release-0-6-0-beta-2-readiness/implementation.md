# PromptHub 0.6.0-beta.2 Readiness Implementation

## Status

- Phase: converge
- Status: published and completed

## Baseline

- Published stable: `v0.5.9`.
- Published preview: `v0.6.0-beta.1`.
- Target candidate: `v0.6.0-beta.2`.
- The remote has no beta.2 tag or GitHub Release at preparation time.
- There are 33 non-merge commits between the beta.1 tag and the preparation
  baseline on `main`.

## Implemented

- Shipped manifests, Expo metadata, project context, CLI runtime, direct CLI
  assertion, and version-alignment test now use `0.6.0-beta.2`.
- Root and localized README preview surfaces, `CHANGELOG.md`, the website
  changelog mirror, the 0.6 release record, and the release index now describe
  beta.2 while stable-facing metadata remains on `v0.5.9`.
- Release validation found and corrected three stale test assumptions without
  changing production behavior:
  - the Playwright seed fixture callback no longer looks like a React hook to
    ESLint;
  - the Homebrew updater test now asserts the documented early ownership guard
    does not create an irrelevant backup;
  - the self-hosted backup E2E obtains its exact-match client version from the
    root package instead of hard-coding beta.1.

## Verification

- `node --test scripts/version-alignment.test.mjs`: passed, 2 tests.
- `pnpm --filter @prompthub/cli test -- tests/run.test.ts --run`: passed, 19
  tests.
- `pnpm --dir website test:release-sync`: passed, 4 tests with 100% coverage
  for `release-metadata.mjs`.
- `pnpm spec:test`: passed for 16 active changes.
- `pnpm spec:index:check`: passed.
- `pnpm verify:release:quick`: passed all 29 checks after correcting the stale
  lint and Homebrew test expectations.
- `pnpm verify:release`: passed all 42 checks in 704.8 seconds, including
  builds, performance budgets, eight desktop unit shards, four integration
  shards, and seven built-artifact Electron E2E tests.
- Formatting checks pass for changed release sources. `AGENTS.md` retains one
  pre-existing table alignment difference outside the version line; it was not
  reformatted to avoid unrelated churn.

## Publication Boundary

- `v0.6.0-beta.2` peels to candidate commit
  `b7854508c3c69eb99cc2d1b6207db02ce5a25ddc`.
- The GitHub release was published as a prerelease at
  2026-09-03 09:52:55 UTC after all publication gates passed.
- Stable-facing `v0.5.9` metadata, downloads, Homebrew, GitHub Latest, and GHCR
  `latest` remain unchanged.

## Tag-Triggered Verification

- The first Desktop workflow run `33737348676` stopped in the Linux verify job
  before packaging because the Doubao detection test hard-coded a macOS
  workspace while the detector correctly selected the runner's native path.
  No Draft Release or desktop artifact was created by that run.
- Self-Hosted Web workflow run `33737348914` passed verification and published
  the prerelease-specific GHCR image without moving `latest`.
- The Doubao test now derives the expected workspace from the current platform
  template through the existing path resolver; its focused three-test suite,
  lint, formatting, and diff hygiene checks pass locally.
- At retry time beta.2 was still unpublished, so the corrected release replaced
  only the observed beta.2 tag object with an expected-old-value lease. An
  unbounded force update was not permitted.
- The retry replaced tag object `dda368b4828bdcd9a5a552df986fa24633cd7d2e`
  with `900c842d64e4f0d629d14989cc0151ac7f70a9e8` using that bounded lease.
- Final Desktop Build and Release run `33738828038` passed the 42-check release
  profile, Linux, Windows x64/arm64, signed/notarized macOS x64/arm64, and the
  release job. Windows x64 passed the packaged two-launch startup smoke.
- Release job `100602404548` verified hashes and uploaded 20 assets to the
  Draft release.
- Final Self-Hosted Web run `33738827888` passed verification and published the
  beta.2 GHCR manifest without moving `latest`.
- After the workflows passed, the Draft release was published as a prerelease.
  Public checks returned HTTP 200 for the release page, update manifest,
  Windows x64 installer, and macOS arm64 DMG.
- GitHub Latest remains `v0.5.9`. GHCR `latest` and `0.5.9` both resolve to
  `sha256:110d9c320236a7bc41fc624b564db58b1f71c13a110ee02b198e0024abc3784e`;
  beta.2 resolves to
  `sha256:677e4d9e6239e53d0a704490bf5b48727ffbe58caa0ec56ee464b9d669e73068`.

## Converge Result

- Release identity, public state, workflow evidence, asset inventory, and
  stable-channel boundaries agree.
- Issue #211 was already closed by the reporter after installing Git. Its
  specific packaged Git-less Windows UI path still requires acceptance;
  general packaged Windows startup passed.
- The change is complete and ready for archival.
