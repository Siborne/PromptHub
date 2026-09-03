# Backup Safety Point Coordination Design

## Ownership

- `apps/desktop/src/main/services/upgrade-backup.ts` owns immutable upgrade
  snapshot creation, validation, lookup, and deletion.
- `upgrade-backup-startup.ts` owns transition reuse against the last-run marker.
- `data-layout-migration.ts` consumes an existing valid point when available;
  it does not own a second backup policy.
- `managed-backup-retention.ts` is the desktop orchestration boundary across the
  existing Core recovery registry and DB safety-point registry. It does not
  redefine either storage format.

## Reuse Identity

A startup-reusable point requires all of:

- exact normalized `fromVersion` and `toVersion` match;
- schema version 3 or newer;
- `runIdentity`, inventory digest, total bytes, and a consistent database image
  or explicit absence of a database;
- finite creation time not earlier than the last-run marker update.

An install that lacks a downloaded target version remains conservative and
cannot be reused automatically.

## Retention Plan

The coordinator runs only when startup created or adopted an upgrade or layout
safety point; ordinary launches do not rescan the backup trees. It performs one
bounded metadata scan and an `O(n log n)` sort for at most the already bounded
managed artifacts. Modern immutable upgrade points use their manifest-declared
payload bytes for accounting, while legacy manifests without that field fall
back to a filesystem size traversal. Active durable bytes are measured with a
stat-only, non-following traversal of `data/`, `config/`, and `secrets/`.
The default budget is `max(512 MiB, activeBytes * 3)`, with at most eight managed
points and a 30-day optional age. The newest point in each family and explicit
protections are selected first; optional points are added newest-first while all
limits remain satisfied.

After the full plan exists, each owning registry receives the exact protected
ids and removes only its own unselected valid entries. A family failure is
logged and does not block the remaining startup or mutate active data.
The same coordinator supports a read-only dry run so current installations can
be measured without applying the deletion plan.

## Complexity And Resources

- Active-byte measurement: `O(f)` filesystem metadata reads for `f` durable
  entries, `O(d)` traversal stack for bounded depth, no file-content hashing.
- Retention planning: `O(n log n)` time and `O(n)` memory for bounded managed
  points; no network I/O.
- Ordinary startup without a new or adopted safety point: `O(1)` trigger check
  and no registry or active-data traversal.
- Snapshot reuse avoids an otherwise `O(B)` read/write copy of durable bytes
  `B` and the same additional disk allocation.
