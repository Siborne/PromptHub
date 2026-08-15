# Desktop Startup Delta

## Added Requirements

### `FR-UPLOCK-001`: Recover a proven orphan before upgrade snapshot

After the Desktop has acquired the Electron single-instance lock and before an
upgrade snapshot opens the active SQLite database, startup must recover an
ordinary database lock only when the shared lease inspection proves there is no
live or unknown owner.

#### Scenario: stale registered owner

- Given the canonical database has an ordinary lock directory;
- and its only client lease belongs to a dead process;
- when a newer Desktop version creates its mandatory upgrade snapshot;
- then startup removes the stale lease and orphan lock through the shared
  recovery contract;
- and creates a verified consistent database image before continuing.

#### Scenario: live or unsafe owner

- Given the database lock has a live client, unknown owner, symbolic link, or
  unsafe path type;
- when upgrade startup evaluates the snapshot;
- then startup preserves the lock evidence and reports `snapshot-failed`;
- and it does not advance the last-run version marker.
