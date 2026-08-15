# Design

<!-- traceability: enforced -->

## `DES-UPLOCK-001`: Guarded pre-snapshot recovery

`runUpgradeBackupStartupTasks()` already knows whether the current launch is a
real upgrade. Immediately before `createUpgradeDataSnapshot()`, resolve the
canonical `data/prompthub.db` first and the legacy root database second. Reuse
`recoverDatabaseClientLock()` for that selected path. Continue only for
`absent` or `recovered`; convert `blocked` into the existing `snapshot-failed`
startup result.

This keeps recovery after the Electron single-instance gate, avoids opening the
database merely to inspect ownership, and preserves the mandatory snapshot as a
fail-closed boundary.

## Affected Areas

- Data model: none.
- IPC / API: none.
- Filesystem / sync: may remove only an ordinary orphan `.lock` directory and
  stale lease entries through the existing shared recovery primitive.
- UI / UX: a recoverable stale lock no longer produces the startup error dialog;
  blocked ownership still does.

## Tradeoffs

- Recovery runs only on version advancement, which is the path that needs the
  pre-initialization database image. Normal same-version startup continues to
  rely on `initDatabase()` recovery.
- No retry loop is added. A live owner is not assumed transient because the
  product must not weaken process/database ownership to make startup appear
  successful.

## Failure And Rollback

- External boundary: filesystem lease and lock inspection, followed by SQLite
  `VACUUM INTO` for the consistent image.
- Partial failure behavior: failed recovery or capture leaves the version marker
  unchanged and removes the incomplete snapshot staging directory.
- Recovery/rollback: close the owning process or repair the lock through the
  explicit doctor contract; no database row or schema rollback is required.

## Analyze Result

- Requirement links: `FR-UPLOCK-001`.
- Verification links: `TEST-UPLOCK-001`, `TEST-UPLOCK-002`.
- Blocking conflicts: none; stable database concurrency rules explicitly allow
  Desktop orphan recovery after the single-instance gate.
- Unresolved `[待确认]`: none.

## Traceability

| Requirement     | Design           | Verification      | Task           |
| --------------- | ---------------- | ----------------- | -------------- |
| `FR-UPLOCK-001` | `DES-UPLOCK-001` | `TEST-UPLOCK-001` | `T-UPLOCK-001` |
| `FR-UPLOCK-001` | `DES-UPLOCK-001` | `TEST-UPLOCK-002` | `T-UPLOCK-002` |
