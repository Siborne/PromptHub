# Agent Rules Source Matrix Implementation

## Status

- Phase: implement
- Status: verified global entry expansion implemented; directory adapters remain pending

## Shipped

- Added shared platform paths and Rules descriptors for:
  - Kiro `<KIRO_HOME>/steering/AGENTS.md`;
  - Cline CLI `~/.cline/data/settings/rules/AGENTS.md`;
  - Augment `~/.augment/user-guidelines.md`.
- Agent capability, descriptor inventory, missing-file confirmation, create,
  edit, version, and conflict behavior continue through the existing shared
  Rules workflow.
- Cursor, Qoder, Cherry Studio, and TRAE remain unavailable because no verified
  user-level filesystem entry is modeled.
- Kiro and Cline sibling rule files remain platform-managed; this phase does
  not claim directory inventory support.

## Verification

- Unit coverage validates exact platform-relative paths, resolved macOS paths,
  descriptor identity and order, capability projection, and negative cases for
  platforms without a verified entry.
- Desktop component/store regression coverage validates missing-file creation
  and existing-empty-file behavior through the shared Rules workflow.
- The focused Playwright scenario validates that Kiro is enabled, does not
  create a file before confirmation, creates the exact zero-byte entry after
  confirmation, and opens the editor.
- 2026-08-10 verification:
  - focused Vitest suite: 6 files, 56 tests passed;
  - focused ESLint: passed;
  - Playwright missing-rule scenarios: 2 passed;
  - desktop TypeScript typecheck: passed;
  - file-size gate, change traceability, and `git diff --check`: passed.

## Follow-ups

- Multi-file source adapters and their traversal, precedence, reconciliation,
  and stress/security gates remain tracked by `T-RULESRC-002` through
  `T-RULESRC-007`.
