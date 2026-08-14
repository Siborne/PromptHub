# Design

## DES-MACTIME-001 Workflow-Local Retry

Keep the retry inside the macOS branch of the existing packaging step. Vite
builds once. Electron-builder output is captured with `tee`, while
`PIPESTATUS[0]` preserves the real package command status.

Only the exact timestamp-service-unavailable diagnostic permits a second
attempt. The retry count is two total attempts and the delay is 60 seconds.
Before retry, only `dist/mac*` staging directories created by electron-builder
are removed; generated source bundles and unrelated runner files are retained.

## Verification

- `TEST-MACTIME-001`: workflow contract test requires the bounded retry limit,
  delay, timestamp diagnostic, and original-status exit path.
- `TEST-MACTIME-002`: the hosted release matrix must still pass macOS signing,
  architecture, notarization, and artifact checks.

## Complexity

The normal path has no extra packaging work. A timestamp outage adds one
bounded retry and 60 seconds of backoff; process count remains sequential and
bounded.
