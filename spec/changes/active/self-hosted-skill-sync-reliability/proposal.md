# Self-Hosted Skill Sync Reliability

## Why

Issue #185 reports two linked failures in the desktop self-hosted workflow:

- importing a local Skill stores its machine-local folder in `source_url`, so desktop backup payloads are rejected by Web's HTTP(S)-only metadata validator;
- repeated pulls merge the same Skill under different desktop/Web IDs, then restore tries to create duplicate names and writes files for IDs that were not restored.

## Scope

- make desktop-to-Web sync payloads portable by removing machine-local Skill paths while preserving real HTTP(S) source metadata;
- reconcile local and remote Skills by a stable portable identity, remap versions and file snapshots to the selected record, and avoid duplicate-name restores;
- cover first pull, repeated pull, local scan/import, and malformed/legacy metadata paths with regression tests.

## Risks and rollback

The change only affects sync serialization and merge normalization. Existing local database rows and managed repositories are not rewritten during push. If a pull fails, the existing restore routine keeps its current failure behavior; reverting the change restores the previous merge behavior.

## Traceability

| Requirement | Design       | Verification  | Task       |
| ----------- | ------------ | ------------- | ---------- |
| `FR-SS-001` | `DES-SS-001` | `TEST-SS-001` | `T-SS-001` |
| `FR-SS-002` | `DES-SS-002` | `TEST-SS-002` | `T-SS-002` |
| `FR-SS-003` | `DES-SS-003` | `TEST-SS-003` | `T-SS-003` |
