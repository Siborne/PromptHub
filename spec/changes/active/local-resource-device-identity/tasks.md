# Tasks

- [x] `T-LOCALID-001` Add null-sync regression coverage and route Plugin/MCP/Agent local projections to storage-root identity. Covers `FR-LOCALID-001`, `DES-LOCALID-001`, `TEST-LOCALID-001`.
- [x] `T-LOCALID-002` Preserve and re-key legacy Agent/MCP device documents without losing payloads. Covers `FR-LOCALID-002`, `DES-LOCALID-002`, `TEST-LOCALID-002`.
- [x] `T-LOCALID-003` Verify malformed identity documents still fail closed and run focused Core/Desktop checks. Covers `NFR-LOCALID-001`, `DES-LOCALID-003`, `TEST-LOCALID-003`.

## Verification Plan

- `TEST-LOCALID-001`: Plugin, MCP, Agent, and renderer persistence fixtures operate with null `selfHostedDeviceId` and stable local IDs.
- `TEST-LOCALID-002`: Legacy UUID Agent/MCP documents retain settings and bindings through read/write recovery.
- `TEST-LOCALID-003`: Existing path, symlink, malformed document, secret, and rollback regressions remain green.
