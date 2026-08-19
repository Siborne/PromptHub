# Spec Delta: Prompt Workspace Completion

## Added Requirements

### `FR-PWCOMP-001`: Ordered multi-message Prompt

A Prompt MAY contain an ordered sequence of `system`, `user`, and `assistant`
text messages. Copy, AI test, version, search, import/export, backup, WebDAV/S3,
self-hosted Web, and CLI output MUST preserve order and role exactly.

### `FR-PWCOMP-002`: Startup folder visibility

A folder MAY be hidden from the initial default Prompt view. Hidden folders and
their descendants remain available through folder navigation, search, settings,
export, sync, and direct selection. Existing folders default to visible.

### `FR-PWCOMP-003`: Managed media export

Every visible Prompt image/video attachment MUST provide an explicit export
action. Export uses the original managed bytes and detected media type, asks
for a destination, and reports failure without mutating the Prompt.

### `NFR-PWCOMP-001`: Compatibility and safety

Existing Prompts migrate without semantic change; old readers retain a useful
system/user projection; media paths cannot escape approved roots; startup
filtering adds no per-row I/O or N+1 query.

## Verification

- `TEST-PWCOMP-001`: migration, CRUD, versions, FTS, copy/test payload, CLI,
  export/import, WebDAV/S3, self-hosted backup, rollback, and old-reader
  projection for multi-message Prompts.
- `TEST-PWCOMP-002`: initial view, nested hidden folders, search/direct open,
  manual navigation, restart, import/export, sync, and legacy default.
- `TEST-PWCOMP-003`: image/video export, duplicate names, cancellation,
  missing/tampered file, MIME mismatch, traversal, symlink, large streaming
  copy, and permission failure.
