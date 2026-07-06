# Implementation

## Shipped

- hardened desktop IPC rebinding by adding the missing `rules:*` and newer `skill:*` channels to the reset list in `apps/desktop/src/main/ipc/index.ts`
- added grouped IPC registration logging so startup failures surface with the failing IPC group label
- made updater IPC registration idempotent in `apps/desktop/src/main/updater.ts`
- moved updater IPC registration earlier in desktop startup so renderer calls do not depend on later bootstrap work completing
- bootstrapped the rules workspace during desktop startup in `apps/desktop/src/main/index.ts`
- moved rules IPC registration ahead of skill IPC in `apps/desktop/src/main/ipc/index.ts` so Rules UI survives unrelated skill IPC registration failures
- added startup logging for built-in global rule scan targets in `apps/desktop/src/main/services/rules-workspace.ts`
- fixed Electron main/preload child builds in `apps/desktop/vite.config.ts` so aliases like `@/main/database` resolve outside the renderer build
- fixed updater IPC handler cleanup to call `ipcMain.removeHandler(...)` with the correct Electron receiver binding
- fixed rules restore in `apps/desktop/src/main/services/rules-workspace.ts` so imported backups now write both the managed copy and the real target file
- added replace-mode cleanup for project rules missing from an imported restore payload
- fixed retained rule history numbering so version files stay monotonic after the 20-version retention window
- fixed Anthropic multimodal chat conversion in `apps/desktop/src/renderer/services/ai.ts` so image attachments are preserved as Anthropic image content blocks
- fixed legacy `AISettings` flows in `apps/desktop/src/renderer/components/settings/AISettings.tsx` so `apiProtocol` is preserved for add, edit, and test actions
- updated desktop backup restore to call `rules.importRecords(..., { replace: true })`

## Verification

- `pnpm --filter @prompthub/desktop test -- --run tests/unit/main/rules-ipc.test.ts tests/unit/main/rules-workspace.test.ts tests/unit/services/database-backup.test.ts tests/unit/services/ai-transport.test.ts tests/unit/components/ai-settings-legacy.test.tsx`
- `pnpm --filter @prompthub/desktop test -- --run tests/unit/main/updater.test.ts tests/unit/main/updater-install.test.ts`
- `pnpm --filter @prompthub/desktop test -- --run tests/unit/main/ipc-index.test.ts tests/unit/main/rules-workspace.test.ts tests/unit/main/rules-ipc.test.ts tests/unit/main/updater.test.ts tests/unit/main/updater-install.test.ts`
- `pnpm --filter @prompthub/desktop build`
- `pnpm --filter @prompthub/desktop lint`

## Notes

- targeted tests still emit expected stderr from existing failure-path fixtures in `database-backup.test.ts`, but the suite passes
