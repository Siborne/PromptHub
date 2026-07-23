# Implementation

## Status

Implemented and verified locally. The change remains active until it is
submitted and converged with the release record.

## Delivered

- Portable Desktop snapshots omit sync credentials, provider/model API keys,
  root AI keys, tokens, passwords, and proxy credentials; restore preserves the
  destination device's local sensitive values.
- WebDAV, S3, self-hosted pull, auto-sync pull, and manual import create a lazy
  local safety snapshot immediately before mutation and restore it on failure.
  Empty installations use a manifest-only baseline so partial first-run imports
  are removable too.
- Prompt, Folder, Prompt Version, Prompt Relation, and Output Format replacement
  uses one validated main-process SQLite transaction. The legacy IndexedDB
  fallback clears and writes its graph in one transaction as well.
- Pre-migration database copies and upgrade startup snapshots are fail-closed.
- SQLite index-entry count corruption is narrowly classified, backed up,
  rebuilt transactionally, and checked again on a fresh connection. Other
  integrity errors still stop startup without mutation.
- Stable recovery, concurrency, sync, and data ownership documents now match
  the implemented SQLite/filesystem boundaries.

## Verification

- `pnpm --filter @prompthub/desktop test -- tests/unit/main/upgrade-backup.test.ts tests/unit/main/backup-ipc.test.ts tests/unit/services/backup-orchestrator.test.ts --run` — 3 files, 41 tests passed after the empty-baseline refinement.
- `pnpm --filter @prompthub/desktop typecheck` — passed after the empty-baseline refinement.
- `pnpm --filter @prompthub/desktop lint` — passed after final convergence.
- `node --experimental-strip-types scripts/verify-release.mts --profile quick` — passed all 18 release-harness stages before the final empty-baseline refinement; included 3,412 Desktop tests, 367 Web tests, 114 CLI tests, 10 Cloudflare tests, lint, typechecks, and builds.
- `node scripts/check-file-line-limits.mjs` — passed after final convergence.
- `git diff --check` — passed after final convergence.
