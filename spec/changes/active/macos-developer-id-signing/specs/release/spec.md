# Release Delta Spec

## ADDED Requirements

### Requirement: macOS releases are signed and notarized

PromptHub macOS release artifacts MUST be built with Hardened Runtime enabled, signed with a Developer ID Application certificate, submitted for Apple notarization, and stapled before upload.

#### Scenario: macOS release job has signing credentials

- Given the release workflow runs for a macOS matrix entry
- And the required signing and notarization secrets are configured
- When the desktop app is packaged
- Then electron-builder signs and notarizes the app
- And CI verifies `codesign`, `stapler`, and `spctl` against the packaged app.

#### Scenario: macOS release job is missing credentials

- Given the release workflow runs for a macOS matrix entry
- And one or more required signing or notarization secrets are missing
- When the build step starts
- Then the job fails before packaging with an explicit missing-secret error.

#### Scenario: local ad-hoc macOS package build

- Given a contributor runs a local macOS package command without release signing credentials
- When `PROMPTHUB_MAC_RELEASE_SIGN` is not `true`
- Then the desktop builder does not require Developer ID or notarization credentials.

#### Scenario: macOS release job uses supported notarization credentials

- Given the release workflow runs for a macOS matrix entry
- And the Developer ID certificate secrets are configured
- And either App Store Connect API key secrets or Apple ID app-specific password secrets are configured
- When the build step starts
- Then the workflow accepts the credential set and runs the signed notarized package build.

### Requirement: macOS credentials are scoped to macOS jobs

The release workflow MUST NOT export the macOS Developer ID certificate as the generic `CSC_LINK` environment variable for Windows or Linux matrix entries.

#### Scenario: Windows and Linux build jobs run

- Given the release workflow runs for Windows or Linux
- When electron-builder is invoked
- Then no macOS `CSC_LINK` or `CSC_KEY_PASSWORD` value is exported for that platform build.

### Requirement: Public release notes avoid Gatekeeper bypass as the default path

Generated release notes and README files MUST describe notarized macOS artifacts as the normal install path and MUST NOT instruct users to remove quarantine attributes as the primary startup path. Historical unsigned builds MAY document quarantine removal as an explicit recovery path.
