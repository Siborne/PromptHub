# Spec Delta: Mobile WebDAV Distribution

## Added Requirements

### `FR-MOBILEWD-001`: Mobile Prompt consumption

The mobile application MUST browse, search, open, and copy Prompts from its
local mobile database while offline. Prompt text, folders, tags, ordered
messages when supported, and available media metadata MUST survive restart.

### `FR-MOBILEWD-002`: Explicit WebDAV snapshot exchange

Mobile MUST pull and push the versioned portable Prompt snapshot through a
configured WebDAV endpoint. Before replacing local state it MUST compare local
and remote snapshot identity/revision, present a conflict choice, validate the
download, and create a recoverable local checkpoint.

### `FR-MOBILEWD-003`: Installable release artifacts

Release automation MUST produce and verify an Android APK/AAB and an iOS signed
archive suitable for the selected distribution channel. Install, upgrade,
offline launch, WebDAV exchange, copy, and uninstall/data-retention behavior
MUST be exercised on supported devices or faithful platform runners.

### `NFR-MOBILEWD-001`: Mobile security and capacity

WebDAV credentials MUST use the native secure store. Network and archive input
MUST be untrusted, TLS-validated, time-bounded, cancellable, size-limited, and
protected against traversal, symlinks, decompression bombs, and secret logging.

## Verification

- `TEST-MOBILEWD-001`: local browse/search/copy, Unicode/large Prompt, restart,
  offline mode, empty/corrupt store, and migration fixtures.
- `TEST-MOBILEWD-002`: pull/push, ETag/revision conflict, wrong credentials,
  TLS/timeout/retry, cancellation, altered/oversized archive, partial import,
  checkpoint rollback, and retry idempotency.
- `TEST-MOBILEWD-003`: Android/iOS install, upgrade, permissions, secure-store
  lifecycle, background/foreground interruption, offline launch, and artifact
  signature/package validation.
