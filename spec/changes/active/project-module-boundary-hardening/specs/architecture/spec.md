# Architecture Delta

## Requirements

### FR-PMB-001 Enforced Size Boundary

No source or test file MAY exceed the 2,000-line hard limit. New files MUST stay at or below 1,500 lines, unless an active change records the exception. Existing 1,500+ line files are ratcheted by a checked-in baseline and MUST be removed from that baseline once they fall to 1,500 lines or below.

### FR-PMB-002 Responsibility-Based Extraction

Every split MUST identify the new module owner, input/output contract, side-effect boundary, dependency direction, and verification layer. A split based only on line ranges is invalid.

### FR-PMB-003 Incremental Compatibility

Each refactor stage MUST preserve observable behavior and keep public APIs, IPC/preload contracts, persisted state, and storage layout stable unless a separate approved change defines a contract migration.

### FR-PMB-004 Test Architecture

Oversized tests MUST be split by public workflow or adapter boundary. Shared helpers may contain fixture construction and setup only; assertions and behavior ownership stay in the domain suite.

### FR-PMB-005 Conflict-Aware Scheduling

Modules owned by another active change MUST be refactored through that change or with an explicit cross-reference. Project-wide cleanup MUST NOT silently compete with active feature work.

## Traceability

| Requirement | Design | Verification | Task |
| --- | --- | --- | --- |
| `FR-PMB-001` | `DES-PMB-001` | `TEST-PMB-001` | `T-PMB-001`, `T-PMB-007`, `T-PMB-011` |
| `FR-PMB-002` | `DES-PMB-002`, `DES-PMB-005` | `TEST-PMB-002` | `T-PMB-002`, `T-PMB-005`, `T-PMB-006`, `T-PMB-008`, `T-PMB-010` |
| `FR-PMB-003` | `DES-PMB-002`, `DES-PMB-003` | `TEST-PMB-003` | `T-PMB-002` through `T-PMB-010` |
| `FR-PMB-004` | `DES-PMB-002` | `TEST-PMB-004` | `T-PMB-003`, `T-PMB-009` |
| `FR-PMB-005` | `DES-PMB-003` | `TEST-PMB-005` | `T-PMB-004` through `T-PMB-010` |

## Acceptance Criteria

- The repository has a reproducible inventory and automated line limit check.
- Every production and test file is at or below the 2,000-line hard limit.
- At least one production god module and one oversized test suite are reduced through cohesive extraction.
- Newly extracted modules stay below 1,000 lines by default and functions remain below 50 lines unless documented.
- The active change records remaining modules in risk/benefit order with tests and ownership boundaries.
