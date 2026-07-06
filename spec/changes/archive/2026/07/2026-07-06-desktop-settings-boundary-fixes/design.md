# Design

## Summary

Create a new `apps/desktop/src/main/settings/settings-readers.ts` module for database-backed settings reads that do not depend on Electron IPC. Use it from both `settings.ipc.ts` and `skill-installer.ts`.

In the renderer, keep `githubToken` in memory only, exclude it from zustand persist via `partialize`, and load it from the main-process settings API after hydration completes in `App.tsx`.

## Affected Modules

- `apps/desktop/src/main/settings/settings-readers.ts`
- `apps/desktop/src/main/ipc/settings.ipc.ts`
- `apps/desktop/src/main/services/skill-installer.ts`
- `apps/desktop/src/main/index.ts`
- `apps/desktop/src/renderer/stores/settings.store.ts`
- `apps/desktop/src/renderer/App.tsx`

## Tradeoffs

- The token is still stored in SQLite for now, but no longer duplicated into renderer localStorage.
- Loading the token from main process at startup adds one async step, but removes the renderer persistence leak.
