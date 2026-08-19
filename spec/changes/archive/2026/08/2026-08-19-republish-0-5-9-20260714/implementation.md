# 0.5.9 Replacement Release Implementation

## Status

Status: completed and ready for dated archive. Release documentation, local
verification, Desktop artifacts, stable-channel metadata, Self-Hosted Web
publication, and representative remote downloads are synchronized.

The 2026-08-18 remote audit recorded why this record remained active at that
time:

- GitHub exposes `v0.5.9` as a published **prerelease**, not a stable release.
- GitHub Latest stable therefore resolves to `v0.5.8`.
- The `v0.5.9` release has the expected platform and CLI assets, but its channel
  flag contradicts the local stable release record and README wording.
- `v0.6.0-beta.1` is still a draft prerelease with an untagged draft URL, which
  is consistent with its withdrawn release record.

The 2026-08-19 release preparation corrected the stable-channel metadata:

- `v0.5.9` is now non-draft, non-prerelease, and GitHub Latest.
- GitHub Latest resolves to the `v0.5.9` release rather than `v0.5.8`.
- Latest Windows x64/arm64, macOS x64/arm64, Linux AppImage/deb, `latest.yml`,
  and `latest-mac.yml` endpoints all returned HTTP 200.
- The beta draft and tag were not modified by this correction.

## Verification

- Focused implementation suites, Desktop lint, Desktop typecheck, Desktop build,
  hidden-startup synchronization E2E, and diff checks passed before release
  preparation.
- `pnpm verify:release`: passed all 22 stages in 934.6 seconds (CLI 86, Desktop
  unit 3,256, Desktop integration 40, Desktop E2E 7, Web 337, Worker 10 tests).
- Desktop Build and Release assets: published for `v0.5.9`; stable-channel
  promotion and eight representative download/update endpoints are verified.
- Final remote closeout (2026-08-19): the Desktop and Self-Hosted Web workflows
  for the final tag commit both concluded successfully;
  `ghcr.io/legeling/prompthub-web:0.5.9` is present; GitHub stable/Latest flags
  are correct; and the eight representative platform/update URLs return 200.

## Converge

- Requirements, design, verification, tasks, stable release record, remote
  GitHub state, GHCR image, and public download behavior now agree.
- No task, review, publication, or external gate remains.
- Final destination:
  `spec/changes/archive/2026/08/2026-08-19-republish-0-5-9-20260714/`.

## Stable Records

- `CHANGELOG.md`
- `spec/releases/0.5.9.md`
- `spec/releases/README.md`
- `spec/knowledge/behavior/desktop.md`
