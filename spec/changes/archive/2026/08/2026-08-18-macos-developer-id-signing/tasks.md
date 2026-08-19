# Tasks

- [x] `T-MAC-001`: Define the release, credential, rollback, and documentation
  boundaries. Covers `FR-MAC-001`, `DES-MAC-001`, `TEST-MAC-002`.
- [x] `T-MAC-002`: Enable Hardened Runtime, entitlements, and notarization for
  release builds. Covers `FR-MAC-001`, `DES-MAC-001`, `TEST-MAC-001`.
- [x] `T-MAC-003`: Preserve unsigned local ad-hoc packaging. Covers
  `FR-MAC-001`, `DES-MAC-001`, `TEST-MAC-001`.
- [x] `T-MAC-004`: Scope signing and notarization credentials to macOS CI jobs.
  Covers `FR-MAC-002`, `DES-MAC-002`, `TEST-MAC-002`.
- [x] `T-MAC-005`: Restore and validate App Store Connect API keys without
  committing credential files. Covers `FR-MAC-001`, `FR-MAC-002`,
  `DES-MAC-002`, `TEST-MAC-002`.
- [x] `T-MAC-006`: Verify ZIP and DMG-mounted apps with code-signing, stapling,
  authority, and Gatekeeper checks. Covers `FR-MAC-001`, `DES-MAC-003`,
  `TEST-MAC-002`, `TEST-MAC-003`.
- [x] `T-MAC-007`: Add unit coverage for local and release builder modes. Covers
  `FR-MAC-001`, `DES-MAC-001`, `TEST-MAC-001`.
- [x] `T-MAC-008`: Keep credential guidance internal and sync public notarized
  install guidance. Covers `FR-MAC-003`, `DES-MAC-004`, `TEST-MAC-004`.
- [x] `T-MAC-009`: Add `.gitignore` safeguards for Apple signing credentials.
- [x] `T-MAC-010`: Record implementation and verification results.
- [x] `T-MAC-011`: Confirm the first signed CI artifact with repository secrets
  before archiving this change. Release run `31712011544` completed Developer
  ID signing, notarization, stapling, and Gatekeeper verification for both
  macOS architectures.
