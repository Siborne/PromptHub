# Proposal

## Phase And Status

- Phase: released
- Status: published in `0.5.9`
- Primary requirements: `FR-PORT-001`, `FR-PORT-002`
- Exit condition: the desktop bundle budget, typecheck, focused backup unit test, and real Electron backup round trip pass with the portable restore and E2E-only bridge boundaries in place.

## Why

The 0.5.9 release gate found two connected desktop portability failures:

- The renderer entry statically loaded the complete application and database backup service, exceeding the 150 KB gzip startup-entry budget even though the backup bridge exists only for Electron E2E coverage.
- A backup payload preserved a Skill's machine-local `local_repo_path`. After the restore clears managed repositories, reusing that stale path made every restored Skill file write fail.

The repair keeps normal desktop startup free of E2E-only code and makes a restored Skill package self-contained on the receiving machine.

## Scope

- In scope:
  - Split the renderer application shell behind an async boundary while preserving the `i18nReady` mount gate, `ToastProvider`, and `React.StrictMode`.
  - Expose the preload E2E bridge only when the established `PROMPTHUB_E2E=1` test profile is active.
  - Restore Skill content and source metadata without restoring the machine-local `local_repo_path` write target.
  - Add a regression assertion and run the real Electron backup/restore scenario.
- Out of scope:
  - Changing Skill source provenance, source identifiers, package fingerprints, update baselines, or user-facing backup format versions.
  - Changing non-E2E preload APIs or the main-process database schema.
  - Raising bundle-budget thresholds.

## Risks

- The renderer must not mount before the E2E bridge is ready in test mode.
- Dropping more than `local_repo_path` would erase source-reconciliation metadata needed for future update checks.
- A lazy dialog split must not hide a requested restore/import confirmation.

## Rollback Thinking

- Reverting the app-shell lazy boundary restores the previous startup graph without changing stored data.
- Reverting the backup restore sanitization is not recommended after release because it reintroduces writes to stale or external paths; its regression coverage makes the failure explicit.

## Related Records

- Release verification: `spec/changes/active/release-verification-harness/`
- Stable desktop performance policy: `spec/knowledge/structure/desktop-frontend-performance.md`
- Stable Skill package behavior: `spec/knowledge/behavior/skills.md`
