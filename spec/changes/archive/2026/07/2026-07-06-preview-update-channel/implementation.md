# Implementation

## Summary

Implemented a guarded desktop preview-update opt-in flow. Stable remains the default channel, and users must explicitly confirm preview risks and backup guidance before PromptHub switches update checks to prerelease builds.

## Delivered Changes

- Added a confirmation modal to `AboutSettings` before enabling the preview update channel.
- Kept switching back to the stable channel immediate and one-click.
- Added explicit risk, backup, and consent copy to all 7 desktop locale files.
- Added component tests covering preview opt-in confirmation and fallback to stable.
- Synced the stable release spec with the new desktop update-channel contract.
- Added a dedicated preview-download entry to the README download table and the GitHub release notes download table so prerelease builds have an explicit public entry point.
- Synced the same preview-download entry into the localized README variants under `docs/README.*.md`.
- Removed remaining Chinese fallback strings from the preview-channel settings section so non-Chinese locales render the intended translation keys.
- Added GitHub issue form templates with default labels plus area / platform / version fields to speed up triage.

## Deviations From Plan

- No updater main-process change was required because the current renderer and updater call chain already passes `updateChannel` through manual and background update checks.

## Verification

- Commands run:
- `pnpm --filter @prompthub/desktop test -- --run tests/unit/components/about-settings.test.tsx tests/unit/components/update-dialog.test.tsx tests/unit/main/updater.test.ts`
- `pnpm --filter @prompthub/desktop lint`
- `pnpm --filter @prompthub/desktop test -- --run tests/unit/components/about-settings.test.tsx tests/unit/components/update-dialog.test.tsx tests/unit/components/renderer-i18n-smoke.test.tsx`
- Tests passed:
- `tests/unit/components/about-settings.test.tsx`
- `tests/unit/components/update-dialog.test.tsx`
- `tests/unit/components/renderer-i18n-smoke.test.tsx`
- `tests/unit/main/updater.test.ts`
- Build / lint status:
- Desktop lint passed

## Synced Specs And Docs

- Updated `spec/releases/release-rules.md`
- Updated `README.md`
- Updated `.github/workflows/release.yml`
- Updated `docs/README.en.md`, `docs/README.ja.md`, `docs/README.zh-TW.md`, `docs/README.de.md`, `docs/README.fr.md`, and `docs/README.es.md`
- Added `.github/ISSUE_TEMPLATE/config.yml`, `.github/ISSUE_TEMPLATE/bug-report.yml`, and `.github/ISSUE_TEMPLATE/feature-request.yml`

## Follow-Up

- None yet.
