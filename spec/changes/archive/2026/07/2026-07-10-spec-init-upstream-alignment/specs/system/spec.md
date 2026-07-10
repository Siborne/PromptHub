# Spec Delta: Spec-init Upstream Alignment

## FR-SPECINIT-001: Pin and synchronize the embedded skill

PromptHub MUST record the upstream `spec-init` revision used by its embedded
skill and MUST preserve upstream scaffold behavior except for documented
PromptHub-specific adaptations.

## FR-SPECINIT-002: Apply the phase workflow

PromptHub MUST represent `specify`, `clarify`, `plan`, `tasks`, `analyze`,
`implement`, and `converge` in its topology and contributor rules.

### Scenario: Implement a non-trivial change

- **GIVEN** a change has requirements, design, verification, and tasks
- **WHEN** implementation is about to begin
- **THEN** the change records an analyze result with no blocking inconsistency
- **AND** completion requires a converge result and movement out of `active/`.

## FR-SPECINIT-003: Maintain verification as stable project knowledge

PromptHub MUST maintain separate stable entries for test strategy, standards,
design methodology, case inventory, regression suites, fixtures, and coverage
mapping while keeping detailed product-specific truth in existing rules and
reference documents.

## FR-SPECINIT-004: Govern record naming and archives

New standalone internal records MUST receive stable typed IDs and index entries.
Existing change keys and historical archive paths MUST remain compatible.

### Scenario: Add a new internal issue or ADR

- **WHEN** a standalone internal issue or ADR is created
- **THEN** it receives an `ISS-YYYYMMDD-NNN` or `ADR-YYYYMMDD-NNN` ID
- **AND** its directory index records its status and path
- **AND** existing GitHub-numbered snapshots and historical changes are not renamed.

## FR-SPECINIT-005: Provide enforceable change templates

PromptHub's local change templates MUST include phase/status, traceability,
analyze, converge, implementation, and archive checks, plus a delta-spec
template.

## Traceability

| Requirement       | Design             | Verification        | Task                                                 |
| ----------------- | ------------------ | ------------------- | ---------------------------------------------------- |
| `FR-SPECINIT-001` | `DES-SPECINIT-001` | `TEST-SPECINIT-001` | `T-SPECINIT-001`, `T-SPECINIT-002`, `T-SPECINIT-007` |
| `FR-SPECINIT-002` | `DES-SPECINIT-002` | `TEST-SPECINIT-002` | `T-SPECINIT-003`, `T-SPECINIT-007`                   |
| `FR-SPECINIT-003` | `DES-SPECINIT-003` | `TEST-SPECINIT-003` | `T-SPECINIT-004`, `T-SPECINIT-007`                   |
| `FR-SPECINIT-004` | `DES-SPECINIT-004` | `TEST-SPECINIT-004` | `T-SPECINIT-004`, `T-SPECINIT-006`, `T-SPECINIT-007` |
| `FR-SPECINIT-005` | `DES-SPECINIT-005` | `TEST-SPECINIT-005` | `T-SPECINIT-005`, `T-SPECINIT-007`, `T-SPECINIT-008` |
