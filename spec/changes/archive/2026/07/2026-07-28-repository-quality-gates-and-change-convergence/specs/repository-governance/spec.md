# Repository Governance Delta

## Requirements

### FR-GATE-001: Honest change lifecycle

Completed changes with no unchecked delivery tasks must live in the dated
archive. Changes with required release or device checks must remain active with
an explicit pending status.

### FR-GATE-002: Path-aware pull-request verification

Every pull request must run repository governance checks. Desktop, CLI, mobile,
and shared package checks must run when the changed paths can affect that
surface, including transitive shared-package dependencies.

### FR-GATE-003: Worker verification

Changes to the Cloudflare Worker or its shared dependencies must trigger lint,
typecheck, and test verification in the web workflow.

## Acceptance Criteria

- `AC-GATE-001`: The active index contains no completed change whose checklist
  is fully checked.
- `AC-GATE-002`: A deterministic local test covers direct, transitive, root
  fan-out, and documentation-only path classification.
- `AC-GATE-003`: Workflow contract tests prove that governance is unconditional
  and each product surface has the expected commands.

## Traceability

| Requirement | Design | Verification | Task |
| --- | --- | --- | --- |
| `FR-GATE-001` | `DES-GATE-001` | `TEST-GATE-001` | `T-GATE-001` |
| `FR-GATE-002` | `DES-GATE-002` | `TEST-GATE-002` | `T-GATE-002` |
| `FR-GATE-003` | `DES-GATE-003` | `TEST-GATE-003` | `T-GATE-003` |
