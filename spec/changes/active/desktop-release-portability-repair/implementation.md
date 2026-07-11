# Implementation

## Status

- Phase: converge
- Status: release-pending

## Shipped

- `main.tsx` now starts the application chunk alongside locale initialization and retains the existing i18n-ready mount gate.
- The preload E2E bridge is restricted to the exact `PROMPTHUB_E2E=1` profile used by the Electron runner and screenshot harness. Normal desktop startup no longer loads the E2E backup module.
- Data settings defer dialog code until a restore, import, recovery, or destructive action actually opens a dialog.
- Backup restore removes only a Skill's `local_repo_path` before creation. Source metadata and package reconciliation fields remain unchanged; the restored content and files create a managed local package on the receiving machine.
- The existing backup restore unit test now includes a stale prior-machine repo path and proves it is not passed to `skill:create`.

## Verification

- `TEST-PORT-001`:
  - Command: `pnpm --filter @prompthub/desktop build`
  - Result: passed; renderer bootstrap emits `index-*.js` at 32.05 KB gzip and the application moves to `App-*.js`.
- `TEST-PORT-002`:
  - Command: `pnpm --filter @prompthub/desktop bundle:budget`
  - Result: passed; main entry 32.05 KB gzip / 150 KB and DataSettings 13.98 KB gzip / 15 KB.
- `TEST-PORT-003`:
  - Command: `pnpm --filter @prompthub/desktop exec vitest run tests/unit/services/database-backup.test.ts`
  - Result: passed, 21 tests. The new stale-path assertion failed before the restore sanitization and passes after it.
- `TEST-PORT-004`:
  - Command: `pnpm --filter @prompthub/desktop exec playwright test tests/e2e/backup-restore.spec.ts`
  - Result: passed, 1 test. The test launches Electron with `PROMPTHUB_E2E=1`, observes the backup bridge, and completes media, Skill metadata, versions, and multi-file Skill restore.
- Additional checks:
  - `pnpm --filter @prompthub/desktop typecheck` passed.
  - `pnpm --filter @prompthub/desktop exec vitest run tests/unit/components/data-settings-paths-recovery.test.tsx tests/unit/components/data-settings-backup-sync.test.tsx` passed, 16 tests.

## Analyze

- Traceability complete: `FR-PORT-001/002 -> DES-PORT-001/002 -> TEST-PORT-001..004 -> T-PORT-001..006`.
- Conflicts/blockers resolved: the stale-path E2E failure was reproduced, traced to restore payload ownership, and verified after the minimal correction.

## Converge

- Stable workflow/knowledge/rules synced: desktop performance and Skill restore boundaries updated.
- Issues/releases/ADRs/indexes synced: change index regenerated; release commit and archive remain pending publication.
- Final change destination: `spec/changes/archive/2026/07/2026-07-11-desktop-release-portability-repair/` after the replacement release is published.

## Synced Docs

- `spec/knowledge/structure/desktop-frontend-performance.md`
- `spec/knowledge/behavior/skills.md`
- `spec/changes/index.md`

## Follow-ups

- None required for this repair. Source-update baseline reconciliation remains governed by its existing change and stable Skill contract.
