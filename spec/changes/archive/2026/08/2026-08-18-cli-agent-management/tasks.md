# Tasks

- [x] `T-CLI-AGENT-001` Extract reusable Agent root/config normalization and build the settings-backed inventory (`FR-CLI-AGENT-001`, `003`; `DES-CLI-AGENT-001`..`003`; `TEST-CLI-AGENT-001`, `003`).
- [x] `T-CLI-AGENT-002` Implement atomic visibility, custom CRUD, built-in override and identity mutations (`FR-CLI-AGENT-002`..`004`; `DES-CLI-AGENT-002`, `003`; `TEST-CLI-AGENT-002`, `003`).
- [x] `T-CLI-AGENT-003` Add the `agent` CLI route, help, selectors and JSON/table presentation with tests first (`FR-CLI-AGENT-001`..`004`; `DES-CLI-AGENT-004`; `TEST-CLI-AGENT-001`..`003`).
- [x] `T-CLI-AGENT-004` Run focused tests/coverage, Core and CLI typechecks, file-size/static scans, then converge implementation and stable documentation (`NFR-CLI-AGENT-001`; `TEST-CLI-AGENT-004`).
- [x] `T-CLI-AGENT-005` Add failing black-box tests for native config inventory, redacted reads, disabled inclusion, missing files and unsafe path boundaries (`FR-CLI-AGENT-005`; `DES-CLI-AGENT-005`; `TEST-CLI-AGENT-005`).
- [x] `T-CLI-AGENT-006` Implement `agent config list|read`, update help/stable docs, and run focused CLI/Core verification (`FR-CLI-AGENT-005`; `DES-CLI-AGENT-004`, `005`; `TEST-CLI-AGENT-004`, `005`).

## Analyze Result

- All FRs have acceptance/verification coverage and map to design/tasks.
- Data source remains SQLite `settings`; no competing store or migration is introduced.
- Deep runtime adapters stay explicitly outside this slice; capability output remains truthful.
- Native config inspection reuses the existing Core service and remains read-only; no second discovery policy, backup format or secret store is introduced.
- No blocking conflict or `[待确认]` remains.

## Review Exit Condition

- Satisfied by commit `7d0b2043` (`feat(agent): complete management workbench`).
  The earlier instruction to remain active while uncommitted was stale after
  that commit and no longer blocks the dated archive.
- Repository-wide file-size debt and concurrent Agent-workbench test failures are recorded in `implementation.md`; they do not change the scoped CLI acceptance result.
