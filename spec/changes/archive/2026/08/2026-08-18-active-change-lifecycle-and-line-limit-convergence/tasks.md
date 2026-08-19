# Tasks

- [x] `T-CONVERGE-001` Read lifecycle, archive, definition-of-done, code-quality,
      TDD, and PromptHub `spec-init` rules; inspect all active change task and
      implementation records (`FR-CONVERGE-001`, `DES-CONVERGE-001`).
- [x] `T-CONVERGE-002` Record the 60-change audit, archive eligible completed
      changes, and correct inconsistent active statuses
      (`FR-CONVERGE-001`, `FR-CONVERGE-002`, `TEST-CONVERGE-001`).
- [x] `T-CONVERGE-003` Split each governed legacy source still above the
      preferred ceiling while preserving public entry points and current dirty
      recovery work (`FR-CONVERGE-003`, `DES-CONVERGE-003`,
      `TEST-CONVERGE-003`, `TEST-CONVERGE-004`).
- [x] `T-CONVERGE-004` Regenerate the change inventory and run focused tests,
      affected typechecks/lint, file-size, spec governance/traceability, and the
      risk-selected release profile (`NFR-CONVERGE-001`,
      `TEST-CONVERGE-001`..`TEST-CONVERGE-005`).
- [x] `T-CONVERGE-005` Record actual verification, remaining lifecycle gates,
      stable-doc synchronization, and final archive destination.
- [x] `T-CONVERGE-006` Reconcile CLI archive records with current Git history,
      source/test ownership, and stale exit-condition text
      (`FR-CONVERGE-004`, `TEST-CONVERGE-006`).
- [x] `T-CONVERGE-007` Split `apps/cli/tests/run.test.ts` and
      `apps/cli/tests/skill.test.ts` by command responsibility so both return
      below the 1,000-line default (`FR-CONVERGE-004`, `DES-CONVERGE-003`,
      `TEST-CONVERGE-006`).
- [x] `T-CONVERGE-008` Extract the currently modified Prompt workspace restore
      marker so `prompt-workspace.ts` returns below the enforced
      1,500-line ceiling without changing recovery behavior
      (`FR-CONVERGE-003`, `DES-CONVERGE-003`, `TEST-CONVERGE-003/004`).
- [x] `T-CONVERGE-009` Converge stale active records whose only open task is
      already satisfied, explicitly unnecessary, or routed elsewhere; retain
      every real verification/publication gate (`FR-CONVERGE-001/002`,
      `TEST-CONVERGE-001/002`).
- [x] `T-CONVERGE-010` Record current GitHub release metadata for `v0.5.9` and
      `v0.6.0-beta.1` and correct stale release tasks without publishing or
      changing remote state (`FR-CONVERGE-005`, `DES-CONVERGE-005`,
      `TEST-CONVERGE-007`).
- [x] `T-CONVERGE-011` Run the focused CLI/Prompt workspace tests, affected
      typechecks/lint, file-size gate, spec/index/traceability checks, and the
      bounded changed-risk harness; then converge and archive this audit.

## Analyze Result

- Complete traceability:
  `FR-CONVERGE-001 -> DES-CONVERGE-001 -> TEST-CONVERGE-001 -> T-CONVERGE-002`.
- Complete traceability:
  `FR-CONVERGE-002 -> DES-CONVERGE-002 -> TEST-CONVERGE-002 -> T-CONVERGE-002`.
- Complete traceability:
  `FR-CONVERGE-003 -> DES-CONVERGE-003 -> TEST-CONVERGE-003/004 -> T-CONVERGE-003`.
- Complete traceability:
  `FR-CONVERGE-004 -> DES-CONVERGE-003 -> TEST-CONVERGE-006 -> T-CONVERGE-006/007/008`.
- Complete traceability:
  `FR-CONVERGE-005 -> DES-CONVERGE-005 -> TEST-CONVERGE-007 -> T-CONVERGE-010`.
- No orphan requirement, design, test, or task identifier was found.
