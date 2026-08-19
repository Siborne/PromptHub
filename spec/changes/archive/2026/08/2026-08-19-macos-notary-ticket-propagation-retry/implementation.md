# Implementation

## Status

Completed and archived on 2026-08-19. The failing remote evidence was Desktop
Release run `32260133354`, attempt 2, macOS arm64 job `96101796201`. The final
tag matrix passed in Desktop Release run `32265536666` at commit
`6c08b5e84d70ecb41b32030b00e2e04fae96319a`.

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
  builds, Web smoke, Cloudflare dry-run, and Mobile gates.
- Final Desktop Release run `32265536666` passed verification, Linux, Windows
  x64, Windows arm64, macOS x64, macOS arm64, and the Release job. Both macOS
  architectures passed signing, notarization, stapling, and Gatekeeper checks;
  neither required an extra packaging attempt in the successful run.
- The Release job verified the merged update manifests and all artifact hashes,
  then replaced the 20 draft assets. The draft was promoted separately only
  after the platform matrix and public asset inventory were verified.
