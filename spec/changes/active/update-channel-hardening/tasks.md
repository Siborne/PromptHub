# Tasks

## Implementation

- [x] 1. Clarify release/update-channel design and preview release versioning policy
- [x] 2. Refactor updater provider/channel logic to remove the broken preview manifest path
- [x] 3. Add explicit downgrade filtering and preview-default inference
- [x] 4. Stabilize renderer update state so background checks do not override visible available/downloaded states
- [x] 5. Update release workflow / docs to match the chosen preview strategy
- [x] 6. Add or update regression tests
- [x] 7. Update `implementation.md`
- [x] 8. Tighten desktop update dialog layout and state-specific backup copy so long release notes and Homebrew flows do not overflow or show irrelevant install gating
- [x] `T-UPDATER-009` Replace the direct-install macOS DMG hand-off with the signed ZIP in-app updater path (`FR-UPDATER-005`, `DES-UPDATER-005`)
- [x] `T-UPDATER-010` Add `TEST-UPDATER-005` and `TEST-UPDATER-006` coverage for direct macOS installation while preserving the Homebrew boundary
- [x] `T-UPDATER-011` Remove development runtime status injection and add `TEST-UPDATER-007` for one-click single-state behavior (`FR-UPDATER-006`, `DES-UPDATER-006`)

## Verification

- [x] Run targeted desktop tests
- [x] Run desktop lint
- [ ] Run release-related verification for updater logic
