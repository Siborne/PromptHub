# Tasks

## Governance and tests

- [x] `T-SHB-001`: Record the backup-only boundary, version policy, storage
      layout, failure behavior, and traceability. Covers `FR-SHB-001`.
- [x] `T-SHB-002`: Add failing Web service/route tests for exact version match,
      atomic per-user snapshots, checksum verification, retention, and live-data
      non-mutation. Covers `FR-SHB-002` and `FR-SHB-003`.
- [x] `T-SHB-003`: Add failing desktop tests proving automatic startup/interval
      paths only upload backups and version mismatch stops before export. Covers
      `FR-SHB-001`, `FR-SHB-002`, and `FR-SHB-004`.

## Implementation

- [x] `T-SHB-004`: Implement the Web snapshot store/routes and desktop backup
      client, then switch manual and automatic self-hosted actions to backup-only.
      Covers `FR-SHB-001` through `FR-SHB-004`.
- [x] `T-SHB-005`: Make restore explicit with a local safety snapshot, update
      settings copy and stable docs, then run focused tests/typechecks. Covers
      `FR-SHB-005`.
- [x] `T-SHB-006`: Enforce the 50 MiB request bound, bounded network timeout and
      read retry, recursive credential rejection, user isolation, symlink refusal,
      and write-failure cleanup. Covers `FR-SHB-002` through `FR-SHB-004`.

## Verification matrix

| Verification   | Scope                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------------- |
| `TEST-SHB-001` | Startup/interval paths never pull, merge, or mutate local data                                                       |
| `TEST-SHB-002` | Client and server reject mismatched/unknown versions before write                                                    |
| `TEST-SHB-003` | Atomic per-user store, checksum, retention, and live workspace isolation                                             |
| `TEST-SHB-004` | Snapshot contains all portable non-secret content and inline media                                                   |
| `TEST-SHB-005` | Explicit restore creates a local safety snapshot before replacement                                                  |
| `TEST-SHB-006` | Credential, user-isolation, symlink, collision, durability-failure, timeout, and request-size boundaries fail closed |
