# PromptHub 0.6.0-beta.2 Readiness Implementation

## Status

- Phase: converge
- Status: local candidate ready; publication pending

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

- No tag, GitHub Release, package, installer, update manifest, or container
  image is created by this preparation batch.
- Stable-facing `0.5.9` metadata and downloads remain unchanged.
- Tag-triggered Windows x64 two-launch, macOS signing/notarization, artifact,
  updater-manifest, GHCR, and public URL checks remain publication-stage gates.
