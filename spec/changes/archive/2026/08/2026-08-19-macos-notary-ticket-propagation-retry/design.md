# macOS Notary Ticket Propagation Retry Design

<!-- traceability: enforced -->

## `DES-MACNOTARY-001`: Bounded Packaging Retry Classifier

The existing macOS packaging loop captures each `electron-builder` attempt in
a bounded runner log. A failed attempt is retried only when that log contains
either the timestamp-service marker or the post-notarization ticket marker
`Could not find base64 encoded ticket` / staple Error 65. The loop performs at
most three attempts, sleeps 60 seconds between attempts, and removes only the
job-owned `dist/mac*` directory before rebuilding.

This is constant-space log classification with at most three packaging runs.
Every attempt still performs signing and notarization; the separate codesign,
stapler, and Gatekeeper verification step remains mandatory. Unknown failures
and the final retryable failure exit with the original status.

## Verification

- `TEST-MACNOTARY-001`: workflow regression locks the total-attempt limit,
  delay, both retry classifications, last-attempt failure, and unchanged
  explicit signing/notarization verification.
- Remote tag matrix must pass both macOS architectures before publication.

## Traceability

| Requirement         | Design              | Verification         | Task              |
| ------------------- | ------------------- | -------------------- | ----------------- |
| `FR-MACNOTARY-001`  | `DES-MACNOTARY-001` | `TEST-MACNOTARY-001` | `T-MACNOTARY-001` |
| `NFR-MACNOTARY-001` | `DES-MACNOTARY-001` | `TEST-MACNOTARY-001` | `T-MACNOTARY-001` |
