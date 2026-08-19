# Prompt Workspace Completion Proposal

## Phase And Status

- Phase: analyze
- Status: design-ready
- Primary requirements: `FR-PWCOMP-001`, `FR-PWCOMP-002`, `FR-PWCOMP-003`
- Related issues: #44 residual multi-shot request, #74, #195
- Exit condition: each track can ship independently with compatible persistence,
  explicit user actions, and complete regression coverage.

## Why

Three remaining requests belong to the Prompt workspace but touch different
parts of its lifecycle: structured multi-message authoring, a clean startup
view, and export of uploaded media. One change records their shared Prompt
boundary while preserving independently reversible implementation tasks.

## Scope

- Ordered system/user/assistant message sequences with legacy Prompt
  compatibility, versioning, search, copy, export, and sync.
- Folder-level startup hiding that never deletes or globally filters data.
- Per-attachment image/video export from managed Prompt media.
- Existing launch-minimized and copy-system-Prompt fixes are not reimplemented.

## Risks And Rollback

- Multi-message storage changes SQLite, shared contracts, FTS, versions, sync,
  and old-client behavior; it is isolated behind an additive schema migration.
- Startup hiding applies only to the initial default view.
- Export is read-only and never changes the managed media source.

## Related Records

- `spec/knowledge/behavior/prompt-workspace.md`
- `spec/knowledge/structure/prompt-protocols-zh.md`
- `spec/changes/active/desktop-image-generation-workbench/`
