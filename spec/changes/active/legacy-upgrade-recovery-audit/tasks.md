# Legacy Upgrade Recovery Audit Tasks

- [x] `T-LEGACYREC-001` Inventory issue evidence, tagged path rules, backup
      formats, current ownership, recovery services, and existing tests; record
      the result in `evidence.md` (`FR-LEGACYREC-001`, `DES-LEGACYREC-001`).
- [ ] `T-LEGACYREC-002` Add deterministic fixture builders and manifests for
      v0.4.7, v0.4.8, v0.5.1, and v0.5.2 without committing user data
      (`FR-LEGACYREC-001`, `TEST-LEGACYREC-089`, `TEST-LEGACYREC-097`,
      `TEST-LEGACYREC-098`).
  - Implemented database slice: tag/commit-anchored synthetic SQLite builders
    cover all four versions with Prompt and Skill history. Pending: Windows path,
    browser storage, portable JSON, and upgrade-snapshot artifact fixtures.
- [ ] `T-LEGACYREC-003` Write the failing-or-falsifying #89 Windows path
      transition tests before production changes, including cancellation,
      locking, corruption, explicit selection, restart, and no-write assertions
      (`FR-LEGACYREC-002`, `DES-LEGACYREC-003`, `TEST-LEGACYREC-089`).
- [ ] `T-LEGACYREC-004` Write separate #97 tests for v0.5.1 portable JSON import
      and v0.5.2 upgrade-snapshot restore, including invalid artifacts and
      failure rollback (`FR-LEGACYREC-003`, `DES-LEGACYREC-004`,
      `TEST-LEGACYREC-097`, `TEST-LEGACYREC-004`).
- [ ] `T-LEGACYREC-005` Write the #98 four-version invariant across SQLite,
      IPC, renderer history, restart, and rollback to intermediate versions
      (`FR-LEGACYREC-004`, `DES-LEGACYREC-005`, `TEST-LEGACYREC-098`).
- [ ] `T-LEGACYREC-006` Classify each fixture result and implement only the
      smallest reproduced production fix in the owning module; do not add a new
      schema or recovery engine without a failing test (`FR-LEGACYREC-005`,
      `DES-LEGACYREC-006`).
- [ ] `T-LEGACYREC-007` Add bounded capacity, adversarial path/artifact, and
      failure-injection coverage; record elapsed time, memory, and temporary
      disk (`NFR-LEGACYREC-001`, `DES-LEGACYREC-007`,
      `TEST-LEGACYREC-005`, `TEST-LEGACYREC-004`).
- [ ] `T-LEGACYREC-008` Run focused tests and the changed/release harness,
      update `implementation.md`, stable recovery knowledge, and local issue
      evidence, then complete analyze/converge checks.
- [x] `T-LEGACYREC-009` Reproduce and repair the startup failure caused by
      legacy Prompts with an empty version chain. Preserve strict canonical
      validation, synthesize version 1 transactionally, align counters, and
      prove reopen idempotency (`FR-LEGACYREC-006`, `DES-LEGACYREC-008`,
      `TEST-LEGACYREC-006`).
- [x] `T-LEGACYREC-010` Run source-database migrations before canonical
      publication and exclude only empty target-missing Rule discovery
      placeholders from projection. Prove preparation ordering, fail-closed
      behavior, and placeholder filtering (`FR-LEGACYREC-007`,
      `DES-LEGACYREC-008`, `DES-LEGACYREC-009`, `TEST-LEGACYREC-007`).
- [x] `T-LEGACYREC-011` Allow canonical Prompt and MCP readers to coexist with
      their exact legacy version workspace, Agent appearance workspace, and
      market-source registry artifacts without weakening symlink, type, or
      undeclared-path validation
      (`FR-LEGACYREC-008`, `DES-LEGACYREC-010`, `TEST-LEGACYREC-008`).
- [x] `T-LEGACYREC-012` Extend exact-name shared-root coexistence to superseded
      MCP and Plugin metadata files, migrate populated superseded libraries
      exactly once without allowing stale resurrection, reproduce the live
      second-start failure, and retain fail-closed handling for symlinks, type
      substitutions, and unknown entries
      (`FR-LEGACYREC-008`, `DES-LEGACYREC-010`, `TEST-LEGACYREC-008`).
  - MCP and Plugin migration also accepts the pre-sync null renderer device ID
    and uses a stable root-scoped local identity for device-local metadata.
- [ ] `T-LEGACYREC-013` Add an explicit older-client startup refusal and a
      recovery-required state for an authority marker whose declared canonical
      graph is invalid. Preserve both SQLite and legacy-workspace candidates and
      require explicit source selection before publication
      (`FR-LEGACYREC-009`, `DES-LEGACYREC-011`, `TEST-LEGACYREC-009`).
  - Implemented the invalid-graph validation and Prompt workspace write gate.
    Pending: older-client refusal and explicit candidate selection/publication.
