# Implementation

## Shipped

- Refactored `apps/desktop/src/main/updater.ts` to remove the broken `preview.yml` path.
- Stable checks still use the GitHub provider, while preview checks now resolve the latest prerelease tag and read the real `latest*.yml` manifest from that release via a generic feed URL.
- Added explicit downgrade filtering before surfacing `update-available`, so remote versions `<= currentVersion` are emitted as `not-available` instead of appearing as installable updates.
- Added shared semver-aware version helpers in `apps/desktop/src/utils/version.ts` so prerelease comparisons like `0.5.6-beta.1 < 0.5.6` are handled correctly.
- Extended `apps/desktop/src/renderer/stores/settings.store.ts` with `updateChannelExplicitlySet` and `inferUpdateChannel(version)` so prerelease app versions can default to preview until the user explicitly opts out.
- Stabilized renderer update state in `apps/desktop/src/renderer/App.tsx` and `apps/desktop/src/renderer/components/UpdateDialog.tsx` so background `checking` events no longer override visible `available` / `downloaded` states and cause UI flicker.
- Added regression coverage for downgrade filtering and dialog-state stability in `apps/desktop/tests/unit/main/updater.test.ts` and `apps/desktop/tests/unit/components/update-dialog.test.tsx`.
- Updated release policy and public docs so `0.5.5-beta.1` is documented as a historical beta reissue that restores a machine-readable prerelease marker without replacing `0.5.5` as the current stable release.
- Replaced the shared version-helper imports in `src/main/updater.ts` and `src/renderer/stores/settings.store.ts` with relative paths after CI showed that the main-process Vite sub-build did not resolve the top-level `@` alias consistently.
- Tightened the preview-only contract for `0.5.5-beta.3`: preview checks no longer treat stable releases as fallback candidates, user-facing locale copy now explains that returning to stable requires turning the preview channel off, and additional regression coverage was added for prerelease feed selection plus beta/stable SemVer ordering.
- Tightened `apps/desktop/src/renderer/components/UpdateDialog.tsx` so the update UI now reuses the shared `Modal` shell, keeps release notes inside a bounded scroll area, shortens the `available` state copy to version-focused guidance, and reserves installation acknowledgement UI for the `downloaded` state.
- Removed the misleading in-app install backup gate from Homebrew-managed `available` / `downloaded` flows and kept those paths focused on Homebrew / Releases guidance instead.
- Extended `apps/desktop/tests/unit/components/update-dialog.test.tsx` to lock in the lighter download-stage backup copy and the Homebrew-specific available-update behavior.
- Direct macOS installations now use `electron-updater.downloadUpdate()` and
  `quitAndInstall(false, true)` after the existing pre-upgrade snapshot. The
  released ZIP, rather than a manually opened DMG, is the update payload.
- Homebrew remains excluded from the in-app download and install paths.
- The downloaded-update dialog now presents direct macOS installation as a
  restart action, with no manual DMG guidance or redundant Downloads action.
- Added regression coverage for direct macOS native download/install behavior
  and for the corresponding dialog action while preserving Homebrew coverage.
- `TEST-UPDATER-005`: main-process updater coverage verifies native macOS
  download/restart behavior and the Homebrew ownership boundary.
- `TEST-UPDATER-006`: renderer coverage verifies the direct macOS install
  action without manual DMG or Downloads guidance.

## Verification

- `pnpm test -- --run tests/unit/main/updater.test.ts tests/unit/components/update-dialog.test.tsx tests/unit/components/about-settings.test.tsx tests/unit/main/updater-real-scenario.test.ts`
- `pnpm lint`
- `pnpm build`
- `pnpm --filter @prompthub/desktop test -- --run tests/unit/main/updater.test.ts tests/unit/main/updater-real-scenario.test.ts tests/unit/components/about-settings.test.tsx tests/unit/components/update-dialog.test.tsx tests/unit/components/renderer-i18n-smoke.test.tsx tests/integration/components/main-content-inline-edit.integration.test.tsx tests/integration/components/main-content-large-dataset.integration.test.tsx tests/unit/cli/run.test.ts`
- `pnpm --filter @prompthub/desktop lint`
- `pnpm --filter @prompthub/desktop typecheck`
- `pnpm --filter @prompthub/desktop build`
- `git diff --check` for the macOS updater change: passed
- Targeted Vitest execution: not run locally; release validation is delegated
  to CI by maintainer direction.
- `pnpm --filter @prompthub/desktop test -- tests/unit/components/update-dialog.test.tsx --run`
- `pnpm --filter @prompthub/desktop lint`
- `pnpm --filter @prompthub/desktop build`

## Synced Docs

- Updated `README.md`, all localized `docs/README.*.md`, `spec/releases/release-rules.md`, and `.github/workflows/release.yml` to distinguish stable `0.5.5` from the historical beta `0.5.5-beta.1`.
- Intentionally did not run `website/scripts/sync-release.mjs` in this round, because the current website release sync pipeline assumes `package.json` always represents the latest stable release and would incorrectly replace stable-facing website metadata with the historical beta version.
- Updated `CHANGELOG.md`, `README.md`, all localized `docs/README.*.md`, and `.github/workflows/release.yml` again for `0.5.5-beta.3` so the preview entry points track the current prerelease while stable-facing download surfaces remain on `0.5.5`.
- Intentionally still did not run `website/scripts/sync-release.mjs` for `0.5.5-beta.3`, because the website sync pipeline remains stable-oriented and would overwrite stable-facing metadata with the prerelease version.

## Follow-ups

- Confirm whether current `v0.5.5` prerelease should be treated as a one-off historical exception before switching to semver prerelease tags for the next preview cycle.
- Run release-related verification against an actual prerelease tag once the workflow changes land, since this round only validated runtime logic and targeted tests.
- Future preview lines should still prefer forward-moving prerelease versions such as `0.5.6-beta.1`; `0.5.5-beta.1` remains a one-off backfill exception.
