# Spec Delta: Git Backup Transports

## Added Requirements

### `FR-GITBACKUP-001`: Git backup transport

Users MAY configure a private GitHub or Gitee repository as an encrypted
portable-snapshot backup destination. The product MUST label this as backup,
not live sync, and MUST show last success, remote snapshot identity, size, and
failure without changing local source data.

### `FR-GITBACKUP-002`: Previewed restore

Restore MUST list available snapshots, download and authenticate the selected
encrypted artifact, validate the portable manifest and capacity limits, show a
preview, then use staged import with rollback. A failed restore MUST leave the
active local database and media unchanged.

### `NFR-GITBACKUP-001`: Credential and resource safety

Tokens MUST use the platform secure credential facility, never repository
content or logs. Upload/download MUST be streamed, cancellable, time-bounded,
bounded in retry and temporary disk usage, and resilient to concurrent runs.

## Verification

- `TEST-GITBACKUP-001`: GitHub/Gitee upload, idempotent retry, auth/rate-limit,
  concurrent job exclusion, cancellation, large streaming artifact, and remote
  ref conflict.
- `TEST-GITBACKUP-002`: inventory, correct restore, wrong key, altered bytes,
  manifest mismatch, oversized archive, partial download/import, rollback, and
  cleanup.
- `TEST-GITBACKUP-003`: secret storage, redacted logs, private-repository
  validation, proxy/timeout behavior, and restart recovery.
