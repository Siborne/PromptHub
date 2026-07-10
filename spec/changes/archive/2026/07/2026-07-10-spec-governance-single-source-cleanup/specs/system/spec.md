# Spec Delta: Governance Source Consolidation

## `FR-GOV-001`: One project governance hierarchy

PromptHub MUST use `AGENTS.md`, `spec-init.topology.yml`, and `spec/*` as the
project governance hierarchy and MUST NOT maintain parallel always-on rules
that define competing engineering or design behavior.

### Scenario: Agent locates project constraints

- **GIVEN** an agent enters the PromptHub repository
- **WHEN** it locates project instructions
- **THEN** repository-wide constraints resolve through `AGENTS.md` and `spec/*`
- **AND** `.agents/` contains reusable skills rather than duplicate project
  rule or workflow copies.

## `FR-GOV-002`: One release-sync procedure

PromptHub MUST maintain one reusable release-sync skill that references current
monorepo paths, stable release rules, and the root release harness.

## `FR-GOV-003`: One current delta-spec template

PromptHub MUST expose one canonical delta-spec template for new active changes.

## `FR-GOV-004`: Superseded topology changes leave active state

A change describing a replaced spec topology MUST be marked superseded and
moved to the dated archive instead of remaining an active instruction source.

## Verification

- `TEST-GOV-001`: Assert parallel rule/workflow files and the obsolete template
  are absent.
- `TEST-GOV-002`: Assert the release skill uses current paths and gates.
- `TEST-GOV-003`: Assert the superseded change is archived and inventories are
  current.

## Traceability

| Requirement  | Design        | Verification   | Task                     |
| ------------ | ------------- | -------------- | ------------------------ |
| `FR-GOV-001` | `DES-GOV-001` | `TEST-GOV-001` | `T-GOV-001`, `T-GOV-002` |
| `FR-GOV-002` | `DES-GOV-002` | `TEST-GOV-002` | `T-GOV-003`              |
| `FR-GOV-003` | `DES-GOV-003` | `TEST-GOV-001` | `T-GOV-004`              |
| `FR-GOV-004` | `DES-GOV-004` | `TEST-GOV-003` | `T-GOV-005`, `T-GOV-006` |
