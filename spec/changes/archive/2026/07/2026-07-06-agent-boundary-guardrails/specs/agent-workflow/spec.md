# Delta Spec

## Added

- Agents MUST read `AGENTS.md` and the relevant stable docs before non-trivial implementation.
- Agents MUST create or update an active change folder before data model, data layout, IPC/API, cross-package, or multi-file behavior changes.
- Agents MUST identify the existing behavior owner and current source of truth before modifying an existing feature.
- Agents MUST document database and filesystem storage impacts before implementation.
- Agents MUST choose the lowest effective verification layer and record skipped verification with a concrete reason.

## Modified

- Project structure guidance MUST describe the current monorepo layout instead of the historical single-app `src/` layout.
- The project-local `spec-init` skill MUST respect repository-specific `spec/` topology when present.

## Removed

- None.

## Scenarios

- Scenario: Add a new feature with persistence
  - Given a feature requires a new field, table, file, or sync behavior
  - When an agent starts implementation
  - Then it first writes a change record covering schema/storage impact, migration, rollback, and verification

- Scenario: Modify existing behavior
  - Given a behavior already has a stable boundary doc or active change record
  - When an agent edits it
  - Then it must update the same boundary record or explicitly explain why a new change folder is needed

- Scenario: New agent has no memory of prior chat
  - Given the agent only sees the repository
  - When it reads `AGENTS.md`
  - Then it can find the monorepo layout, data ownership rules, and required change workflow without relying on chat context
