# Legacy Upgrade Recovery Audit Implementation

## Status

Design and repository-history audit are complete. The database portion of the
historical fixture catalog is implemented; path, browser-storage, portable JSON,
and upgrade-snapshot fixtures remain pending. The shared migration and managed
safety-point remediations remain owned by `database-migration-safety`.

## Completed Evidence Work

- Correlated #89 with the v0.4.7 to v0.4.8 Windows runtime-path change and the
  reporter's install-directory to roaming-directory observation.
- Separated #97 into portable JSON backup import and automatic upgrade-snapshot
  restore boundaries.
- Confirmed that both v0.5.1 and v0.5.2 portable formats include Prompt
  `versions`, while current `PromptDb.getVersions` requests the complete ordered
  chain.
- Mapped current ownership to `packages/core`, `packages/db`, shared contracts,
  and desktop main/renderer boundaries without introducing a competing recovery
  framework.
- Converted the next phase into fixture-first tasks with explicit safety,
  rollback, restart, and performance gates.

## 2026-08-11 Database Fixture Progress

- Added deterministic builders anchored to the exact commits tagged `v0.4.7`,
  `v0.4.8`, `v0.5.1`, and `v0.5.2`; no user data or binary database is committed.
- Each generated database contains a four-version Prompt, one Folder, one Skill
  version, and the legacy migration markers emitted by that release profile.
- Current initialization preserves all rows, corrects Prompt `current_version`,
  commits numeric/checksummed adoption, creates one managed safety point, passes
  `quick_check`, and reopens without creating a duplicate point.

## Verification

- Repository source/tag audit: completed; facts recorded in `evidence.md`.
- Historical database fixture tests: 4 passed for `v0.4.7`, `v0.4.8`, `v0.5.1`,
  and `v0.5.2`, including row preservation, ordered Prompt history, numeric and
  checksummed adoption, one managed safety point, `quick_check`, and reopen.
- Combined Desktop storage/recovery matrix: 81 tests passed. CLI concurrency
  remained green with 21 tests and self-hosted Web bootstrap passed 1 test.
- `packages/db` and `packages/core` TypeScript checks passed. The Desktop-wide
  check is currently blocked by unrelated concurrent Agent activation test API
  changes.
- `pnpm spec:index:check`: passed.
- `pnpm spec:test`: passed, including governance, inventory, single-source, and
  traceability checks for 22 enforced changes.
- `git diff --check`: passed.

## 2026-08-12 Empty Prompt Version-Chain Repair

- Reproduced desktop startup rejection when historical Prompt rows had no
  `prompt_versions` records after `fix_prompt_current_version_v1` had already
  been marked complete.
- Added the idempotent `repair_empty_prompt_version_chain_v1` database migration.
  It synthesizes version 1 from current Prompt content and aligns
  `current_version` to the highest positive stored version without weakening the
  canonical resource schema.
- Added a tagged historical-database regression covering both a version-0 Prompt
  and a version-1 Prompt with empty version chains, canonical graph validation,
  content preservation, and reopen idempotency.
- Focused historical fixture verification passed: 5 tests.
- Related canonical rebuild and startup verification passed: 10 tests.
- A copied production database with 127 Prompts passed the migration and full
  canonical graph validation. Seven missing initial versions were recovered;
  no Prompt remained at a non-positive counter or referenced a missing current
  version.
- The repository package-manager wrapper could not start because its remote
  package-manager signature check was unavailable. Verification used the
  repository-installed Vitest binary; no package-manager metadata was changed.

### Startup publication follow-up

- Moved source-database preparation ahead of canonical projection while keeping
  the renderer migration, existing-authority, and source-file safety gates in
  front of it. A migration failure now blocks publication.
- Reproduced the next strict-validation failure against the live data: nine
  built-in Rule platform discovery rows were `target-missing` placeholders with
  version zero and no content or history.
- Kept the Rule resource schema strict and changed only projector eligibility:
  pure empty placeholders are not canonical resources, while target-missing
  Rules with durable content or history remain validated and publishable.
- Focused canonical projector, startup, historical fixture, and canonical
  rebuild verification passed: 4 files, 21 tests.

### Shared-root coexistence follow-up

- Reproduced a second-cold-start Prompt graph rejection caused by the legacy
  `.versions/<prompt-id>/<version>.md` workspace living beside canonical
  resources. The graph reader now excludes only an exact, real `.versions`
  directory and still rejects a file or symlink at that path.
- Reproduced MCP library startup errors caused by the independently managed
  `data/mcp/market-sources.json` registry. Canonical MCP enumeration now
  excludes only that exact regular file and still rejects a directory or
  symlink substitution.
- Added focused positive and fail-closed regressions for both coexistence
  boundaries.
- Reproduced a later second-cold-start inventory mismatch after Agent appearance
  seeded its bundled Codex theme. Prompt inventory now excludes only the exact,
  real `agent-appearance` directory and rejects a file or symlink substitution.
- Concurrent Agent appearance requests now coalesce bundled-theme seeding by
  resolved theme directory across service instances. A failed seed is removed
  from the in-flight map so a later request can retry.
- Final focused Desktop and Core regression suites pass 58 tests. Desktop and
  Core TypeScript checks pass, and the Desktop production Vite build completes.
- Two consecutive real cold starts against the current user database completed
  without a canonical startup error. The exact development sessions were then
  stopped and port 5173 was released.
- Remaining non-blocking diagnostics are broken external Skill symlink warnings
  under the local Codex Skill directory and the existing Vite `fflate`
  static/dynamic import chunk warning; neither prevents startup.

## Remaining Risk

Current recovery code and tests now prove the shared SQLite migration slice for
all four tagged schemas, including a four-version Prompt. They do not yet prove
the v0.4.7/v0.4.8 Windows path transition, a v0.5.1 portable backup, or a v0.5.2
upgrade-snapshot restore through the complete application path. Issues #89,
#97, and #98 remain open and must not be marked locally done from this evidence.
