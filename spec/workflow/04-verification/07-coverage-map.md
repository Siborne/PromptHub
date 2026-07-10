# Coverage Map

## Project-Level Mapping

| Requirement area                 | Design/knowledge                                           | Verification assets                                    | Known follow-up                                     |
| -------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------- |
| Local-first storage and recovery | `spec/knowledge/behavior/data-recovery.md`, structure docs | DB, backup, migration, recovery tests; release harness | keep migration/rollback matrices current            |
| Multi-platform Skill lifecycle   | skills behavior and agent platform references              | Skill defect taxonomy and regression matrix            | expand new platform/package variants as added       |
| Plugin and MCP adapters          | plugin behavior, adapter matrix, agent platform references | core/main/store/component contract tests               | deeper per-target conformance remains change-owned  |
| Desktop/Web/CLI contracts        | workflow design and app behavior docs                      | package typecheck/lint/unit/integration/E2E            | cross-surface parity must be recorded per change    |
| Sync/backup/export               | sync behavior and release records                          | sync providers, backup/import/export tests             | every new durable field needs round-trip coverage   |
| Documentation governance         | `spec/README.md`, `spec/rules/*`, topology                 | spec-init scaffold/governance tests                    | historical active-change debt is tracked separately |

## Update Rule

When a stable requirement, architecture boundary, or long-lived test asset is
added, update this map or a linked domain matrix. Temporary command output and
coverage percentages stay in the relevant change implementation record.
