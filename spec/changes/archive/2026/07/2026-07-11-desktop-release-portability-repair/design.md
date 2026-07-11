# Design

## `DES-PORT-001`: Renderer Startup And E2E Boundary

`apps/desktop/src/renderer/main.tsx` starts `import("./App")` in parallel with `i18nReady` and renders it through `React.lazy` plus `Suspense`. The existing language-ready gate, `ToastProvider`, and `React.StrictMode` remain in the mount path.

`apps/desktop/src/preload/index.ts` exposes `window.electron.e2e` only when `process.env.PROMPTHUB_E2E === "1"`. Desktop E2E launch helpers and screenshot capture both set that exact environment value; normal production renderer processes no longer request the E2E backup module. In E2E mode, `main.tsx` awaits the dynamic backup import before mounting so `window.__PROMPTHUB_E2E_BACKUP__` is ready for the test.

## `DES-PORT-002`: Portable Skill Restore Target

`restoreFromBackup()` continues to preserve Skill identity, source provenance, source-update baselines, and package fingerprints. Before it calls `skill:create`, it removes only `local_repo_path` from the restored create payload.

`local_repo_path` is a machine-specific filesystem write target, not portable backup state. The existing local-repo resolver then creates a PromptHub-managed repo from the restored Skill content and writes the backed-up directory files there. This prevents a restore from targeting a deleted managed directory or an external directory selected on another machine.

## Affected Areas

- Data model: no schema or backup-format change.
- IPC / API: the test-only preload `e2e` object is absent outside the explicit E2E profile; its existing methods and E2E behavior remain unchanged in that profile.
- Filesystem / sync: restored Skill files are rehydrated to a managed local package path; source metadata and source baselines remain intact.
- UI / UX: normal startup no longer parses E2E backup code; data-settings dialogs load only after a dialog workflow becomes active.

## Tradeoffs

- The app shell uses one additional renderer chunk request, but it begins while locale initialization is already in progress and removes application and backup code from the budgeted bootstrap entry.
- Retaining source fingerprints preserves future source-update reconciliation. A later source refresh can re-evaluate them against the rehydrated package.

## Failure And Rollback

- External boundary: `PROMPTHUB_E2E=1` is the shared main/preload/test-runner profile. The targeted Electron E2E test verifies that the preload process receives it and exposes the backup bridge before use.
- Partial failure behavior: existing restore aggregation still reports failed file writes. The new path rule eliminates stale-path failures without suppressing genuine filesystem errors.
- Recovery/rollback: no durable migration is introduced. A failed restore remains reported; normal Skill restore reconstructs a managed repo from the payload.

## Analyze Result

- Requirement links: `FR-PORT-001`, `FR-PORT-002`.
- Verification links: `TEST-PORT-001` through `TEST-PORT-004`.
- Blocking conflicts: the historical frontend performance change excluded IPC work, so this repair is recorded as a separate active change rather than extending that scope.
- Unresolved `[待确认]`: none.

## Traceability

| Requirement   | Design         | Verification                     | Task                       |
| ------------- | -------------- | -------------------------------- | -------------------------- |
| `FR-PORT-001` | `DES-PORT-001` | `TEST-PORT-001`, `TEST-PORT-002` | `T-PORT-001`, `T-PORT-003` |
| `FR-PORT-002` | `DES-PORT-002` | `TEST-PORT-003`, `TEST-PORT-004` | `T-PORT-002`, `T-PORT-004` |
