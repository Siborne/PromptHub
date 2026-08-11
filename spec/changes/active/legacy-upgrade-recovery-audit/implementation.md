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

## Remaining Risk

Current recovery code and tests now prove the shared SQLite migration slice for
all four tagged schemas, including a four-version Prompt. They do not yet prove
the v0.4.7/v0.4.8 Windows path transition, a v0.5.1 portable backup, or a v0.5.2
upgrade-snapshot restore through the complete application path. Issues #89,
#97, and #98 remain open and must not be marked locally done from this evidence.
