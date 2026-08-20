# Database Resource Lifecycle Delta

## Added Requirements

### `NFR-DBLIFE-001`: Task-Owned SQLite Artifacts Are Fully Reclaimed

When a PromptHub-owned temporary database operation completes or fails, cleanup
MUST remove the database, rollback/WAL sidecars, and the
`node-sqlite3-wasm` `.lock` directory. Cleanup MUST be limited to a path already
owned by that operation and MUST NOT recover or delete an operational database
lock without the existing lease policy.

#### Scenario: temporary database close or verification fails

- **Given** a unique temporary database path owned by the current operation
- **And** one or more SQLite sidecars or a `.lock` directory remain
- **When** the operation enters cleanup
- **Then** every owned database artifact is removed
- **And** an unrelated sibling file or external symlink target is preserved

### `NFR-DBLIFE-002`: Temporary Database Names Are Bounded

PromptHub-owned temporary SQLite basenames MUST use a validated fixed label and
a full UUID, remain at or below 64 characters, and not incorporate an arbitrary
destination basename.

#### Scenario: caller provides an unsafe or oversized label

- **When** a temporary database path is requested with traversal, separators,
  an empty value, or a label that would exceed the basename budget
- **Then** path construction fails before creating a file

### `FR-DBLIFE-001`: External Session Store Validation Releases Handles

Agent session adapters MUST close every SQLite handle they open when schema
validation fails or when opening a related second database fails. The adapter
MUST preserve its existing user-facing error classification.

#### Scenario: an external Agent SQLite schema is unsupported

- **Given** PromptHub opens the store successfully
- **When** schema validation rejects it
- **Then** the adapter returns the existing invalid-store error
- **And** no database lock or open handle remains

#### Scenario: NanoClaw outbound database cannot open

- **Given** the inbound database opened successfully
- **When** the paired outbound database open fails
- **Then** the inbound database is closed before the error propagates

## Acceptance Criteria

- `AC-DBLIFE-001`: Cleanup covers `.db`, `-journal`, `-shm`, `-wal`, and `.lock`.
- `AC-DBLIFE-002`: Cleanup cannot follow a `.lock` symlink into an external tree.
- `AC-DBLIFE-003`: All canonical/recovery temporary database call sites use the
  bounded path or complete cleanup primitive where applicable.
- `AC-DBLIFE-004`: Cherry Studio, Hermes, Cherry Skill, and NanoClaw failure
  tests prove opened handles are closed.
- `AC-DBLIFE-005`: No asynchronous callback is passed to the synchronous SQLite
  transaction adapter.
