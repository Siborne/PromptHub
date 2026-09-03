# Backup Safety Point Coordination Proposal

## Why

PromptHub currently creates upgrade snapshots, recovery artifacts, and database
safety points through independent workflows. A single upgrade can therefore
capture the same durable state before installation, again on first startup, and
again before a legacy-layout migration. Residual migration retries can create
additional snapshots even when their marker already references the original
complete rollback point. Family-specific retention limits do not constrain the
aggregate disk footprint.

## Scope

- Reuse one immutable upgrade safety point across install, first startup, and
  the immediately following layout migration when their transition identity is
  exact and recent.
- Reuse the complete safety point referenced by an incomplete layout migration
  instead of creating sparse retry snapshots.
- Coordinate retention for managed upgrade snapshots, recovery artifacts, and
  database safety points under one aggregate byte budget while preserving the
  newest rollback point in every family.
- Exclude standalone transient database backup files from new whole-root
  upgrade snapshots; those files remain independently discoverable recovery
  sources in the active data root.
- Leave invalid, unowned, or manifest-less historical directories untouched.

## Non-Goals

- Changing portable export, cloud backup, or sync formats.
- Deleting current user backup files during development or verification.
- Replacing the existing journaled restore or SQLite safety-point formats.
- Following symbolic links or adopting unowned historical directories.

## Risks And Rollback

- Reusing a stale pre-install snapshot could lose the newest pre-upgrade state.
  Reuse therefore requires an exact `fromVersion -> toVersion` transition, a
  modern validated manifest, and creation after the last-run marker timestamp.
- Aggregate retention could remove a needed rollback point. The newest valid
  point in each family, pinned recovery artifacts, and an incomplete layout
  migration's referenced point remain protected even when they exceed budget.
- Retention is non-fatal and idempotent. A cleanup failure must not block startup
  or partially publish application data.
