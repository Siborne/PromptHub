# Implementation

## Status

In progress. The failing remote evidence is Desktop Release run `32260133354`,
attempt 2, macOS arm64 job `96101796201`.

## Evidence

- Full verify, Windows x64 packaged upgrade cold start, Windows arm64, and
  Linux passed.
- Apple notarization reported success, then CloudKit returned `Record not
found`; stapler could not find the base64 ticket and exited with Error 65.
- The previous loop did not retry because it recognized only the timestamp
  service marker. macOS x64 and the Release job therefore did not complete.

## Implemented

- Renamed the loop budget to package-level semantics and bounded it to three
  total attempts with a fixed 60-second delay.
- Classified only the existing timestamp outage and exact missing-ticket /
  staple Error 65 markers as retryable. Unknown failures and the last attempt
  preserve the original nonzero exit status.
- Retained the separate architecture, codesign, stapler validation, and
  Gatekeeper checks after packaging.

## Verification

- `TEST-MACNOTARY-001` failed first against the timestamp-only loop, then the
  complete release-workflow suite passed 8/8 tests after implementation.
- Targeted Desktop ESLint and Prettier passed.
- Traceability and generated-index checks passed for all active changes.
- `pnpm verify:release` passed 42/42 checks with zero failed or blocked checks,
  including performance, Desktop unit/integration/build/bundle/E2E, CLI/Web
  builds, Web smoke, Cloudflare dry-run, and Mobile gates. The final remote
  platform matrix remains pending.
