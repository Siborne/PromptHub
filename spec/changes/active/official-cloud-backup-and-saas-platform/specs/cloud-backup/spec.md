# Official Cloud Backup Delta Specification

## Added Requirements

### `FR-CBK-001`: Local Authority Is Preserved

Enabling the official cloud backup provider MUST NOT make the remote backup the
live source of truth. Local durable data remains authoritative until the user
explicitly restores or imports a selected backup.

### `FR-CBK-002`: Immutable Versioned Backup Sets

Each completed backup MUST be an immutable backup set with a versioned
manifest, stable backup ID, account/tenant ID, source device ID, client
version, local layout version, snapshot schema version, creation time,
plaintext/ciphertext size metadata, content hashes, and object inventory.

Publishing a backup MUST use an idempotent staged protocol. A manifest becomes
visible only after every required object is uploaded and verified. Interrupted
uploads remain incomplete and are garbage-collected by bounded retention.

### `FR-CBK-003`: Streaming And Bounded Capacity

Backup creation and restore MUST stream/chunk durable files and media. It MUST
NOT serialize the whole library or all media into one in-memory JSON payload.
Upload/download concurrency, retry count, chunk size, object count, total size,
and traversal depth MUST be bounded and entitlement aware.

### `FR-CBK-004`: Secrets And Encryption

Portable backup content MUST exclude provider tokens, API keys, passwords,
session cookies, signing keys, proxy credentials, and device-bound secrets by
default. The selected encryption policy MUST be recorded in the manifest and
must not be described as end-to-end encrypted unless only the client controls
the content key.

### `FR-CBK-005`: Restore Is Previewed And Fail-Closed

Restore MUST validate the manifest version, signatures/authentication data,
hashes, sizes, required objects, compatibility range, available capacity, and
destination state before mutation. The user MUST see the source device, backup
time, version, scope, size, and overwrite/merge consequence before confirming.

A failed restore MUST leave the active local state unchanged or complete an
automatic rollback from one managed safety point. Partial success MUST never be
reported as a successful restore.

### `FR-CBK-006`: Retention And Quota Are Non-Destructive

Retention MUST be deterministic, visible, and entitlement aware. Exceeding a
quota or losing a paid entitlement MAY block new backup publication, but MUST
NOT immediately delete the latest valid backup or prevent export during the
documented grace period.

### `FR-CBK-007`: Historical Compatibility

Backup readers MUST use an immutable, ordered converter registry for supported
snapshot schema families. Unknown newer formats fail without mutation. Legacy
WebDAV/S3/self-hosted exports MAY be imported through the local compatibility
layer and re-uploaded; the official service is not required to execute every
historical desktop migration internally.

### `FR-CBK-008`: Backup And SaaS Import Are Explicit

If a user imports an official backup into a SaaS workspace, the service MUST
create an import job, validate and stage all resources, present duplicate and
conflict consequences, and publish the workspace changes atomically. Merely
uploading or retaining a backup MUST NOT make its contents live in SaaS.

## Acceptance Scenarios

1. Repeating the finalization request with the same idempotency key creates one
   visible backup set.
2. Killing an upload before the final object leaves no restorable backup and no
   unbounded temporary object tree.
3. Corrupting one chunk or manifest hash fails restore before local mutation.
4. Restoring an older supported schema applies the registered converter and
   preserves stable resource IDs and version history.
5. An unsupported newer schema reports an upgrade requirement without changing
   local or remote data.
6. Subscription expiry blocks a new upload according to policy while the latest
   backup remains listable/exportable during the grace period.
7. Uploading a backup does not change any live SaaS workspace record.

## Verification IDs

- `TEST-CBK-001`: manifest/schema/compatibility contract tests.
- `TEST-CBK-002`: staged upload, idempotency, interruption, and garbage
  collection integration tests.
- `TEST-CBK-003`: streaming capacity and bounded concurrency stress tests.
- `TEST-CBK-004`: encryption, secret exclusion, tamper, and key-loss tests.
- `TEST-CBK-005`: restore preflight, partial failure, rollback, and low-disk
  tests.
- `TEST-CBK-006`: quota, retention, entitlement loss, export, and deletion
  lifecycle tests.
- `TEST-CBK-007`: historical fixtures and unknown-newer-version tests.
- `TEST-CBK-008`: backup-to-SaaS import isolation and atomic publication tests.
