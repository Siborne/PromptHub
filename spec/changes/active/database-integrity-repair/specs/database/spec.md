# Database Integrity Repair Delta

## `FR-DBIR-001`: Detect corruption before normal startup writes

Database initialization must run `PRAGMA quick_check` after acquiring the
exclusive client lease and before migrations or schema writes.

## `FR-DBIR-002`: Repair only verified freelist metadata mismatch

When every quick-check diagnostic is a freelist-count mismatch, initialization
must create a timestamped backup, run SQLite `VACUUM`, and require a subsequent
quick check to return `ok` before continuing.

### Scenario: Existing user database has a stale freelist count

- Given the database contains user records and only its freelist count is wrong
- When PromptHub starts
- Then a pre-repair backup is preserved
- And the repaired database passes `PRAGMA quick_check`
- And the user records remain available

## `FR-DBIR-003`: Fail closed for broader corruption

Any quick-check diagnostic outside the verified freelist mismatch must stop
initialization without attempting `VACUUM` or table-level salvage.

## `FR-DBIR-004`: Recover interrupted package operations at process startup

After the database is healthy and before package-operation IPC accepts work,
desktop startup must recover every journaled operation from the previous
process, including a fresh journal whose age is below the normal live-operation
lease. Runtime maintenance calls must retain the lease and leave fresh active
operations untouched.
