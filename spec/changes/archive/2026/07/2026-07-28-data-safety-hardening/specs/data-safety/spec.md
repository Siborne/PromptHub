# Data Safety Delta

## Added Requirements

### `FR-DSH-001` Portable snapshots exclude secrets

Portable, WebDAV, S3, and self-hosted snapshot payloads MUST exclude API keys,
provider credentials, encryption passwords, access tokens, and passwords even
when transport encryption is enabled. Restore MUST preserve the destination
device's existing sensitive settings.

### `FR-DSH-002` Every destructive restore has a rollback snapshot

Before a remote or local import mutates durable state, Desktop MUST create a
complete local safety snapshot. Snapshot failure MUST stop restore. If restore
partially mutates data and then fails, Desktop MUST restore the safety snapshot
or report a distinct rollback-incomplete failure. An initially empty data
directory MUST use an explicit empty baseline rather than skipping rollback
protection.

### `FR-DSH-003` Prompt graph replacement is atomic

Prompt, Folder, Prompt Version, Prompt Relation, and Output Format replacement
MUST run in one main-process SQLite transaction. Any failed insert MUST preserve
the pre-restore graph.

### `FR-DSH-004` Migration backup is a gate

When an existing database requires migration, failure to create the required
pre-migration backup MUST stop initialization before schema or data writes.

### `FR-DSH-005` Index-only corruption is recoverable

When every `quick_check` diagnostic is an entry-count mismatch for an existing
SQLite index, initialization MUST preserve the original database, rebuild only
the named indexes in a transaction, and continue only after a fresh
`quick_check` returns `ok`. Other corruption MUST remain fail closed.

### `FR-DSH-006` Data ownership is unambiguous

SQLite MUST be documented as the durable source of truth for database-owned
PromptHub records. Filesystem workspaces are interoperable projections or
package-owned content and MUST NOT be described as a complete replacement for
SQLite unless an implemented round-trip rebuild contract exists.

## Scenarios

### Remote backup is unencrypted

Given WebDAV or S3 encryption is disabled, when Desktop uploads a snapshot, the
serialized payload contains no local credentials or API keys.

### Remote restore fails after mutation starts

Given a safety snapshot exists, when any restore stage fails after durable state
has changed, the safety snapshot is restored and the partial state is not kept.

### First-run restore fails after mutation starts

Given the local data directory contains no durable user state, when restore
starts and later fails, the empty baseline is restored and partial imported
state is removed.

### Index entries are inconsistent

Given `quick_check` reports only existing index entry-count mismatches, when the
database initializes, the original file is backed up, named indexes are rebuilt,
and startup continues only after verification succeeds.
