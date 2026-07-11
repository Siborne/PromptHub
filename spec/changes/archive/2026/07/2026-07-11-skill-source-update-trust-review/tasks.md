# Tasks

- [x] `T-SUT-001` Record the user report, policy conflict, scope, and traceability (`FR-SUT-001` through `FR-SUT-006`).
- [x] `T-SUT-002` Add red regressions and fix algorithm-aware baseline upgrade plus semantic YAML hashing (`TEST-SUT-001`, `TEST-SUT-006`).
- [x] `T-SUT-003` Add red main/IPC/store tests and implement structured review plus fingerprint-pinned approval (`TEST-SUT-002`, `TEST-SUT-003`, `TEST-SUT-005`).
- [x] `T-SUT-004` Add persisted exact-source trust, update review UI, and revocation controls (`TEST-SUT-004`).
- [x] `T-SUT-005` Run focused unit/integration/typecheck/build verification and sync stable docs and implementation results.
- [x] `T-SUT-006` (`DES-SUT-006`, `TEST-SUT-007`) Bound staged-package source verification and add the unreachable self-hosted source regression.

## Verification IDs

- `TEST-SUT-001`: unchanged private Gitea legacy install returns `up-to-date` and initializes v1 baseline.
- `TEST-SUT-002`: high-risk staged Git/Zip update returns structured review without mutation.
- `TEST-SUT-003`: exact fingerprint approval succeeds; changed fingerprint remains review-required.
- `TEST-SUT-004`: trusted exact source auto-retries and can be revoked.
- `TEST-SUT-005`: blocked/path traversal remains non-overridable.
- `TEST-SUT-006`: YAML block/nested frontmatter hashes semantically and consistently.
- `TEST-SUT-007`: an unresolved self-hosted source address returns a bounded local-package provenance warning instead of timing out the update.
