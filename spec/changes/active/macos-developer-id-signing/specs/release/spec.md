# Release Delta Spec

## ADDED Requirements

### `FR-MAC-001` macOS Releases Are Signed And Notarized

PromptHub macOS release artifacts MUST be built with Hardened Runtime enabled, signed with a Developer ID Application certificate, submitted for Apple notarization, and stapled before upload.

#### `SC-MAC-001` Release job has signing credentials

- Given the release workflow runs for a macOS matrix entry
- And the required signing and notarization secrets are configured
- When the desktop app is packaged
- Then electron-builder signs and notarizes the app
- And CI verifies `codesign`, `stapler`, and `spctl` against the packaged app.

#### `SC-MAC-002` Release job is missing credentials

- Given the release workflow runs for a macOS matrix entry
- And one or more required signing or notarization secrets are missing
- When the build step starts
- Then the job fails before packaging with an explicit missing-secret error.

#### `SC-MAC-003` Local ad-hoc package build

- Given a contributor runs a local macOS package command without release signing credentials
- When `PROMPTHUB_MAC_RELEASE_SIGN` is not `true`
- Then the desktop builder does not require Developer ID or notarization credentials.

#### `SC-MAC-004` Release job uses supported notarization credentials

- Given the release workflow runs for a macOS matrix entry
- And the Developer ID certificate secrets are configured
- And either App Store Connect API key secrets or Apple ID app-specific password secrets are configured
- When the build step starts
- Then the workflow accepts the credential set and runs the signed notarized package build.

### `FR-MAC-002` macOS Credentials Are Scoped To macOS Jobs

The release workflow MUST NOT export the macOS Developer ID certificate as the generic `CSC_LINK` environment variable for Windows or Linux matrix entries.

#### `SC-MAC-005` Windows and Linux build jobs run

- Given the release workflow runs for Windows or Linux
- When electron-builder is invoked
- Then no macOS `CSC_LINK` or `CSC_KEY_PASSWORD` value is exported for that platform build.

### `FR-MAC-003` Public Notes Prefer Notarized Artifacts

Generated release notes and README files MUST describe notarized macOS artifacts as the normal install path and MUST NOT instruct users to remove quarantine attributes as the primary startup path. Historical unsigned builds MAY document quarantine removal as an explicit recovery path.

## Verification

- `TEST-MAC-001`: Unit coverage for unsigned local and signed release builder
  modes.
- `TEST-MAC-002`: Static workflow validation for secret gating, decoded API-key
  validation, credential scoping, ZIP verification, and DMG-mounted app
  verification.
- `TEST-MAC-003`: Signed artifact checks with `codesign`, `stapler`, and `spctl`.
- `TEST-MAC-004`: Public release documentation audit.

## Traceability

| Requirement | Scenarios | Design | Verification | Task |
| --- | --- | --- | --- | --- |
| `FR-MAC-001` | `SC-MAC-001` through `SC-MAC-004` | `DES-MAC-001`, `DES-MAC-002`, `DES-MAC-003` | `TEST-MAC-001`, `TEST-MAC-002`, `TEST-MAC-003` | `T-MAC-001` through `T-MAC-007` |
| `FR-MAC-002` | `SC-MAC-005` | `DES-MAC-002` | `TEST-MAC-002` | `T-MAC-004`, `T-MAC-005` |
| `FR-MAC-003` | - | `DES-MAC-004` | `TEST-MAC-004` | `T-MAC-008` |
