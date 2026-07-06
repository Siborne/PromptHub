# Proposal

## Why

Issue #135 requests a faster restore flow for exported backup archives. Product clarification narrowed the drag-and-drop scope to the backup settings page itself instead of the whole app window.

## Scope

- add a visible drag-and-drop restore affordance in `Settings > Data > Backup`
- reuse the existing import preview and confirmation flow instead of creating a second restore pipeline

## Risks

- backup restore remains destructive, so the confirmation preview must stay mandatory

## Rollback

- keep the existing file-picker-based import action untouched

## Impacted User Flows

- restore a backup from `Settings > Data > Backup`
- restore a backup by dragging a `.json`, `.phub.gz`, `.gz`, or `.zip` export into the backup settings drop target
