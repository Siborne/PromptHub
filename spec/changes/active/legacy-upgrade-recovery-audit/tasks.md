# Legacy Upgrade Recovery Audit Tasks

- [x] `T-LEGACYREC-001` Inventory issue evidence, tagged path rules, backup
      formats, current ownership, recovery services, and existing tests; record
      the result in `evidence.md` (`FR-LEGACYREC-001`, `DES-LEGACYREC-001`).
- [ ] `T-LEGACYREC-002` Add deterministic fixture builders and manifests for
      v0.4.7, v0.4.8, v0.5.1, and v0.5.2 without committing user data
      (`FR-LEGACYREC-001`, `TEST-LEGACYREC-089`, `TEST-LEGACYREC-097`,
      `TEST-LEGACYREC-098`).
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
