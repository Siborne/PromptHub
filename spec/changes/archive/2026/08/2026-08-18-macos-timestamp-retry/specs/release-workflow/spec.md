# Release Workflow Delta

## FR-MACTIME-001 Bounded Timestamp Retry

When signed macOS packaging fails specifically because Apple's timestamp
service is unavailable, the release workflow must wait for a fixed bounded
delay and retry packaging at most once.

### Scenario: transient timestamp outage

- The first packaging attempt reports `The timestamp service is not available`.
- The workflow waits 60 seconds, removes only the incomplete macOS app staging
  directory, and performs one final packaging attempt.

### Scenario: another packaging failure

- The packaging failure does not report the timestamp-service error.
- The workflow exits with the original packaging status without retrying.

## NFR-MACTIME-001 Signing Integrity

The workflow must not disable signing, hardened runtime, timestamping,
notarization, or the existing post-package verification steps.

## Traceability

| Requirement       | Design            | Verification       | Task            |
| ----------------- | ----------------- | ------------------ | --------------- |
| `FR-MACTIME-001`  | `DES-MACTIME-001` | `TEST-MACTIME-001` | `T-MACTIME-001` |
| `NFR-MACTIME-001` | `DES-MACTIME-001` | `TEST-MACTIME-002` | `T-MACTIME-002` |
