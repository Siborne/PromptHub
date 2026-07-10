# Spec Delta: Spec-init Submission Rules

## FR-COMMIT-001: Generate commit rules

`spec-init` MUST generate `docs/rules/commit-rules.md` for both Chinese and
English project scaffolds.

### Scenario: Initialize a project

- **WHEN** a user initializes a Chinese or English project
- **THEN** the scaffold contains localized commit rules
- **AND** `AGENTS.md` and the rules index link to those rules
- **AND** the rules require one logical change per commit and an explicit test status.

## FR-COMMIT-002: Enforce a pre-commit rule lookup

PromptHub and generated projects MUST treat submission rules as a required
pre-commit lookup rather than optional guidance.

### Scenario: Commit non-trivial work

- **WHEN** a contributor or agent prepares a non-trivial commit
- **THEN** it reads the project submission rules first
- **AND** the commit body records its primary change or issue and verification
- **AND** release-pending issues use reference semantics instead of premature closure semantics.

## Traceability

| Requirement     | Design           | Verification      | Task           |
| --------------- | ---------------- | ----------------- | -------------- |
| `FR-COMMIT-001` | `DES-COMMIT-001` | `TEST-COMMIT-001` | `T-COMMIT-001` |
| `FR-COMMIT-002` | `DES-COMMIT-002` | `TEST-COMMIT-002` | `T-COMMIT-002` |
