# Spec Delta: Desktop Workspace Live Refresh

## Added Requirements

### `FR-REFRESH-001`: Explicit refresh

Desktop MUST expose one discoverable refresh action that reloads the active
workspace and all visible derived counts from durable sources.

### `FR-REFRESH-002`: Consistent generation

List, detail, folder, tag, favorite, search, and count projections MUST belong
to the same completed refresh generation. Existing selection is retained when
the entity still exists and cleared with feedback when it does not.

### `FR-REFRESH-003`: Draft safety

Unsaved edits MUST NOT be silently replaced. Refresh either preserves the draft
over the new baseline or asks the user to keep, discard, or cancel.

### `FR-REFRESH-004`: External change detection

Window focus MAY start a refresh only when a bounded revision check reports a
change or the last successful check is stale. It MUST NOT poll continuously.

### `NFR-REFRESH-001`: Bounded work

Only one refresh may run at a time. Repeated requests coalesce, filesystem
scans keep existing depth/file limits, and list reads remain paginated where
the owning domain supports pagination.

## Verification

- `TEST-REFRESH-001`: real SQLite second-connection create/update/delete is
  visible after one refresh without renderer reload.
- `TEST-REFRESH-002`: mixed domain success/failure never publishes half-new
  Prompt projections and returns a structured partial failure.
- `TEST-REFRESH-003`: dirty editor, preserved selection, deleted selection,
  search, filters, counts, and duplicate clicks.
- `TEST-REFRESH-004`: revision check, focus threshold, no polling, large
  inventories, bounded calls, and listener cleanup.
