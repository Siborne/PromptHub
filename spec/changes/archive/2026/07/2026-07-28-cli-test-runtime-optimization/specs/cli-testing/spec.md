# CLI Testing Runtime Delta

## FR-CLI-TEST-001: Fast isolated CLI databases

Ordinary CLI behavior tests must receive independent, empty, fully migrated
databases without rerunning the complete schema initialization for each test.

## FR-CLI-TEST-002: Fresh-install coverage remains real

Tests that verify new database placement or migration semantics must be able to
request an unseeded user-data root.

## NFR-CLI-TEST-001: Bounded runtime and resources

The complete CLI suite must retain all tests and complete within a documented
local runtime budget without parallel SQLite/WASM CPU amplification.

## Acceptance Criteria

- The seeded and unseeded root behavior is covered by an automated test.
- All 114 existing CLI tests still pass.
- Median representative runtime improves materially from the 85.32 second
  baseline; the suite budget prevents a return to repeated full initialization.

## Traceability

| Requirement | Design | Verification | Task |
| --- | --- | --- | --- |
| `FR-CLI-TEST-001` | `DES-CLI-TEST-001` | `TEST-CLI-TEST-001` | `T-CLI-TEST-001` |
| `FR-CLI-TEST-002` | `DES-CLI-TEST-002` | `TEST-CLI-TEST-002` | `T-CLI-TEST-002` |
| `NFR-CLI-TEST-001` | `DES-CLI-TEST-003` | `TEST-CLI-TEST-003` | `T-CLI-TEST-003` |
