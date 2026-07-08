# Design

## Overview

Use electron-builder's native macOS signing and notarization flow. The desktop builder owns the release artifact policy, while GitHub Actions injects credentials only into macOS matrix jobs.

The builder configuration is a CommonJS module instead of static JSON. Local ad-hoc builds default to unsigned macOS artifacts so contributors can still run `pnpm electron:build:mac` without Apple credentials. Release jobs set `PROMPTHUB_MAC_RELEASE_SIGN=true`, which enables Hardened Runtime, entitlements, and notarization.

The maintainer exports a `Developer ID Application` certificate as `.p12` and stores the base64 value in `MAC_CSC_LINK`. A Developer ID Application certificate belongs to the Apple Developer Team, not to one bundle ID; the same team certificate can sign other directly distributed macOS apps when their own bundle identifiers, entitlements, and release pipelines are configured correctly.

Notarization can authenticate with either App Store Connect API-key credentials or an Apple ID app-specific password. The API-key path is preferred for CI, but the workflow accepts the Apple ID path as a fallback so release signing is not blocked by App Store Connect UI setup. The workflow maps `MAC_CSC_LINK` to `CSC_LINK` only inside macOS jobs because electron-builder uses `CSC_LINK` as a generic signing variable.

## Affected Areas

- Data model: none.
- IPC / API: none.
- Filesystem / sync: macOS entitlements are added under `apps/desktop/resources/`.
- UI / UX: generated release notes now present notarized macOS packages as the default install path; README files keep quarantine removal only as a historical-build recovery path for early `0.5.9` preview builds and older unsigned artifacts.
- Release: `.github/workflows/release.yml` now requires macOS signing secrets and verifies signing/notarization before upload.
- Documentation: maintainer-only certificate and secret details stay in internal `spec/` records, not public README files.

## Tradeoffs

- The release workflow becomes stricter: macOS jobs fail if certificate secrets are absent or if no supported notarization credential set is present. This is intentional because unsigned macOS artifacts would violate the release boundary.
- `com.apple.security.cs.disable-library-validation` is enabled to keep Electron native dependencies and unpacked modules compatible under Hardened Runtime. The app does not request broader user-data permissions in entitlements.
- `Developer ID Installer` is not configured because PromptHub currently ships DMG/ZIP artifacts, not PKG installers.
- The certificate secret names remain generic (`MAC_CSC_*`) because the credential may be reused by other apps owned by the same Apple Developer Team. The PromptHub-specific boundary is the release workflow and `appId`, not the certificate itself.
