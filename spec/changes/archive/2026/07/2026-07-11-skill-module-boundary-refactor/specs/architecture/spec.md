# Architecture Delta

## Requirements

### FR-SMB-001 Hard File Limit

New or touched source and test files MUST remain below 2,000 lines. New modules SHOULD remain below 1,000 lines and target 1,500 lines as the normal upper bound.

### FR-SMB-002 Cohesive Boundaries

Splits MUST follow domain responsibility and dependency direction. A file that only re-exports arbitrary fragments or creates circular store/service ownership does not satisfy the requirement.

### FR-SMB-003 Stable Contracts

The refactor MUST preserve Skill store actions, IPC/preload contracts, persisted settings keys, update statuses, safety behavior, and UI outcomes.

### FR-SMB-004 Focused Tests

The private Gitea reconciliation, structured safety review, fingerprint approval, exact-source trust, and blocked-boundary cases MUST live in focused regression suites rather than expanding a legacy god test file.

## Traceability

| Requirement | Design | Verification | Task |
| --- | --- | --- | --- |
| `FR-SMB-001` | `DES-SMB-001` | `TEST-SMB-001` | `T-SMB-001`, `T-SMB-006` |
| `FR-SMB-002` | `DES-SMB-001`, `DES-SMB-002` | `TEST-SMB-002` | `T-SMB-002`, `T-SMB-003`, `T-SMB-008`, `T-SMB-010` |
| `FR-SMB-003` | `DES-SMB-002`, `DES-SMB-003` | `TEST-SMB-003` | `T-SMB-003`, `T-SMB-004`, `T-SMB-008`, `T-SMB-010` |
| `FR-SMB-004` | `DES-SMB-004` | `TEST-SMB-004` | `T-SMB-005`, `T-SMB-009` |

## Acceptance Criteria

- `skill-installer.ts` delegates remote update safety policy to a focused main-process service and is below 2,000 lines.
- New Skill source-update modules have explicit typed inputs and no renderer component dependency.
- The Skill review dialog owns presentation only; update decisions remain in a workflow/controller boundary.
- No new source or test module exceeds 1,500 lines.
- An automated check fails when a newly touched source/test file crosses 2,000 lines.
