# macOS Notary Ticket Propagation Retry

## Status

- Phase: converge
- Status: completed

## Why

The `v0.6.0-beta.1` replacement matrix recorded `notarization successful` for
macOS arm64, then failed while stapling because Apple's CloudKit ticket lookup
returned `Record not found` / Error 65. The existing packaging loop retries
only timestamp-service outages, so a temporary ticket-propagation delay cancels
the remaining matrix and blocks the draft release.

## Scope

- Treat the established timestamp outage and post-success ticket-not-found
  staple failure as bounded retryable packaging failures.
- Keep all other signing, notarization, packaging, and verification failures
  fail-closed.
- Retry at most three total packaging attempts with a fixed 60-second delay and
  clean only the attempt-owned macOS output directory between attempts.

## Risks And Rollback

- Over-broad matching could hide a permanent notarization defect. Only exact
  known log markers are retryable, and the last attempt always propagates the
  original nonzero status.
- Rollback restores the previous timestamp-only loop; no product data, schema,
  credential, artifact naming, or public Release state changes.
