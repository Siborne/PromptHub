# Implementation Record

## Status

Implemented and submitted with the archived change record. Focused behavior,
security, UI, type, build, and release checks pass. No release artifact was
published.

## Implemented behavior

- Added authenticated `/api/backups/desktop` capability, list, latest, and
  create routes without changing the existing Web live workspace.
- Added checksummed per-user immutable snapshot files with retention 10,
  collision refusal, POSIX file/directory durability, and symlink rejection.
- Desktop and Web perform exact release/protocol compatibility checks before
  local export and repeat the client/server version check before Web write.
- Startup, visibility-resume, and interval self-hosted jobs only create remote
  snapshots. They run independently of the selected WebDAV/S3 live-sync source
  and never refresh or replace local records.
- Manual restore first creates a local recovery snapshot, then reads only the
  verified latest remote snapshot and calls the existing replace restore.
- Remote payloads include prompt graph records, complete Skill files and
  versions, Rules, MCP/Plugin libraries and packages, store sources, Agent
  asset files, inline media, and non-secret settings/model definitions.
- Desktop recursively strips known credential fields; Web independently
  rejects credential-like keys in desktop settings/AI extras.
- Settings copy and all seven desktop locales now describe self-hosted Web as
  backup-only. Stable sync/recovery docs and public multilingual README
  sections describe the same boundary.

## Verification log

- Scoped desktop behavior suite: 11 files and 98 tests passed, including
  automatic scheduling, version gating, explicit restore, settings migration,
  authentication, and UI copy.
- Scoped Web persistence/route suite: 5 files and 34 tests passed.
- V8 coverage for `routes/backups.ts`, `atomic-json-file.ts`,
  `desktop-backup-store.ts`, and `self-hosted-backup-snapshot.ts`: 100% lines,
  statements, functions, and branches.
- Desktop, Web, and shared package typechecks passed.
- Scoped desktop and Web ESLint checks passed with zero warnings.
- Locale JSON parsing, scoped Prettier, `git diff --check`, `pnpm spec:test`,
  and `pnpm spec:index:check` passed.
- `pnpm verify:release:quick` passed all 18 gates in 507.1 seconds, including
  3,372 desktop unit tests, 367 Web tests, 114 CLI tests, package builds, and
  Cloudflare lint/typecheck/tests.

## Remaining release work

- Build signed/package artifacts only when a release is requested.
- The self-hosted snapshot payload is authenticated but not encrypted as a
  secret vault. Known configuration credentials are excluded; user-authored
  Prompt/Skill/Rule content is backed up as authored.
- `apps/web-cloudflare` still implements the legacy live-sync API and does not
  yet expose `/api/backups/desktop`; current Desktop correctly rejects it as an
  incompatible safe-backup endpoint.
