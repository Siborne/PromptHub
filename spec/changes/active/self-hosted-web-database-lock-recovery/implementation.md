# Implementation Record

## Status

In progress. The external report was reproduced with a temporary `DATA_ROOT`:
the published Web image includes the shared lease-aware database package, but
`apps/web/src/database.ts` did not enable legacy lock recovery. The Web entry
point now enables the guarded hook, and the stale-lock startup regression test
passes.

## Verification

- `pnpm --filter @prompthub/web exec vitest run --config vitest.config.ts src/database.test.ts`: passed (1 test).
- `pnpm verify:web`: passed (lint, typecheck, 56 files / 337 tests, client build, server build).
- `pnpm spec:index`: passed.
- `node scripts/check-file-line-limits.mjs --report`: passed.
- Docker runtime smoke test is blocked locally because the Docker daemon is
  unavailable; the tag-triggered CI image job remains the release verification.

## Release State

The fix is committed on `main` but is not present in the published `v0.5.9`
image yet. The replacement `v0.5.9` Web publication is now explicitly
authorized. The release tag must point at the commit containing the guarded
Web startup recovery, and the tag-triggered Web workflow must complete before
the issue is considered released.

Local Docker image publication remains unavailable because the Docker daemon is
not running on the release workstation; GitHub Actions is the required real
image build and push boundary.
