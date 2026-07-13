# Implementation Record

## Status

Released. The external report was reproduced with a temporary `DATA_ROOT`:
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
  unavailable; the tag-triggered CI image job completed the real image build
  and publication.

## Release State

The replacement `v0.5.9` tag now points at commit
`5c64eddcd258e64459a0de30925cb13ab3c61568`, which contains the guarded Web
startup recovery. GitHub Actions run `29246697490` completed successfully: Web
verification passed and the GHCR image was published with the `0.5.9`,
`v0.5.9`, `latest`, and `sha-5c64edd` tags. The published `v0.5.9` image digest
is `sha256:9b91fcb6f5623d57f45051055acf2d55eb4ec5630a133a1fda6fd35053cf3351`.

Deployment hosts still need to pull the replacement tag and restart the Web
container; GitHub issue #185 remains open for the broader Skill sync problem.

Local Docker image publication remains unavailable because the Docker daemon is
not running on the release workstation; GitHub Actions is the required real
image build and push boundary.
