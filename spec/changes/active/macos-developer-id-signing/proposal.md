# Proposal

## Why

PromptHub's macOS desktop release artifacts should launch without Gatekeeper workarounds. The project already publishes DMG and ZIP artifacts through GitHub Actions, but the desktop builder configuration still disabled Hardened Runtime and signing identity discovery. This change establishes the release boundary for Developer ID signing and Apple notarization.

## Scope

- In scope:
  - Enable macOS Hardened Runtime and electron-builder notarization for desktop releases.
  - Add Electron runtime entitlements for signed macOS builds.
  - Wire GitHub Actions macOS jobs to repository secrets without exposing macOS credentials to Windows or Linux builds.
  - Accept either App Store Connect API key credentials or Apple ID app-specific password credentials for notarization.
  - Add release verification for code signing, notarization stapling, and Gatekeeper assessment.
  - Document certificate export and required secrets in internal release/change records.
- Out of scope:
  - Windows code signing.
  - Mac App Store distribution.
  - PKG installer signing with a Developer ID Installer certificate.
  - Creating or uploading secrets on behalf of the maintainer.
  - Adding maintainer-only signing instructions to public README files.

## Risks

- Missing or malformed GitHub secrets will now fail macOS release jobs early.
- Entitlements may need to be expanded if a future native dependency requires additional Hardened Runtime exceptions.
- Apple notarization availability can delay release jobs.
- The Developer ID certificate is team-scoped and reusable across apps, so it must be treated as a high-value credential rather than a PromptHub-only file.

## Rollback Thinking

Rollback by disabling `mac.notarize`, setting `hardenedRuntime` back to `false`, and removing the macOS signing verification step. That returns the release to the prior unsigned behavior, but users may again see Gatekeeper warnings.
