# Backup Safety Point Coordination Delta

## Added Requirements

### `FR-BACKUPCOORD-001`: One safety point per upgrade transition

An in-app install MUST record the downloaded target version in its upgrade
safety-point manifest. On the target version's first startup, PromptHub MUST
reuse that point instead of copying the same durable state again only when the
manifest is modern and complete, its version transition is exact, and it was
created after the previous last-run marker. A stale or ambiguous point MUST NOT
be reused.

### `FR-BACKUPCOORD-002`: Layout migration safety-point reuse

The layout migration MUST reuse the safety point created or adopted by the
current startup. A residual retry MUST reuse the valid complete point referenced
by its migration marker. Missing or invalid references MUST fall back to a new
safety point before changing files.

### `FR-BACKUPCOORD-003`: Aggregate managed-backup retention

When startup creates or adopts an upgrade or layout safety point, it MUST plan
retention across valid managed upgrade snapshots, recovery artifacts, and
database safety points before deleting any entry. An ordinary startup with no
new or adopted point MUST skip the aggregate scan. The plan MUST always
preserve the newest valid point in each non-empty family, every pinned recovery
artifact, and the valid point referenced by an incomplete layout migration.
Additional points are retained newest-first within a bounded age, count, and
aggregate byte budget derived from active durable storage. Protected minimums
MAY exceed the budget. Invalid or manifest-less directories MUST remain
untouched by this coordinator.

### `FR-BACKUPCOORD-004`: Whole-root payload hygiene

New canonical upgrade snapshots MUST contain the active consistent SQLite image
but MUST NOT recursively include standalone `prompthub.db.backup-*`,
`prompthub.db.pre-*`, or `prompthub.db.corrupt-*` files. Those files remain
available as independently discoverable database recovery sources.

## Scenarios

### `AC-BACKUPCOORD-001`: In-app update followed by first startup

Given a modern install-time point for the exact target version created after the
last-run marker, first startup reuses its id, advances the marker, and creates no
second snapshot.

### `AC-BACKUPCOORD-002`: Layout retry

Given an incomplete migration marker whose safety point is still valid, retry
moves the residual entries without creating another snapshot and keeps the
original marker reference.

### `AC-BACKUPCOORD-003`: Budget smaller than protected minimums

Given one valid point in every family whose combined size exceeds the computed
budget, all three newest points remain. Older optional points are removed.

### `AC-BACKUPCOORD-004`: Unowned historical directory

Given a manifest-less directory below a historical backup root, retention does
not delete, move, or present it as a valid managed point.
