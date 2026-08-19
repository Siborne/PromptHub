# Proposal

## Problem

Signed macOS release packaging can fail after electron-builder's internal
codesign retries when Apple's timestamp service is temporarily unavailable.
The signing timestamp remains mandatory, but a short external outage should
not require a maintainer to restart the entire multi-platform workflow.

## Scope

- Keep timestamped Developer ID signing mandatory.
- Retry macOS packaging once after a bounded delay only when the build log
  contains Apple's timestamp-service-unavailable error.
- Preserve immediate failure for signing, credential, compilation, and all
  other packaging errors.

## Rollback

Remove the bounded workflow retry block; no application data or package format
changes are involved.
