# Implementation

## Status

Implemented and verified locally; awaiting publication.

## Planned Files

- `packages/shared/types/app-command.ts`
- `packages/shared/constants/ipc-channels.ts`
- `apps/desktop/src/main/tray-menu.ts`
- `apps/desktop/src/main/index.ts`
- `apps/desktop/src/main/settings/language-setting.ts`
- `apps/desktop/src/main/tray-command-dispatcher.ts`
- `apps/desktop/src/main/tray-controller.ts`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/renderer/components/app/DesktopAppCommandBridge.tsx`
- `apps/desktop/src/renderer/components/layout/TopBar.tsx`
- focused unit tests and stable desktop behavior documentation

## Implemented Behavior

- The native tray now exposes localized Agent asset, Quick Add, visibility,
  updater, settings, and quit actions.
- Rule routes to its management workspace; first-class Agent management remains
  capability-hidden.
- Main-process delivery recreates or restores the window and waits for a loading
  renderer before sending.
- The preload buffers early commands instead of dropping them before React
  subscribes.
- The renderer waits for lazy MCP and Plugin workflows to announce readiness
  before opening their existing modals.
- MCP and Plugin now register their creation listener before announcing
  readiness and revoke readiness before cleanup. This removes the first-open
  race observed in a real Electron run.
- Application language changes now synchronize the normalized locale to the
  main-process settings database. Existing users whose language lived only in
  Zustand local storage are migrated during hydration, so the tray no longer
  falls back to the macOS locale.
- The hydration post-processing callback is scheduled after store module
  initialization. This fixes the prior temporal-dead-zone failure that silently
  prevented renderer settings from reaching the main process.
- The near-limit main entry shrank by moving tray lifecycle and dispatch logic
  into focused modules.

## Verification

- Test-first failure was observed for missing menu, settings reader, renderer
  bridge, preload buffer, and Quick Add handling.
- Focused regression suite: 95 tests passed.
- Focused changed-module coverage: 100% statements, branches, functions, and
  lines.
- Production-build Electron regression: MCP creation, Plugin creation, and
  Prompt Quick Add generate mode passed through the main-process command path;
  renderer-only application language also persisted to main-process settings.
- Desktop ESLint passed. The tray change remains within file-size limits and
  `apps/desktop/src/main/index.ts` is below the 2,000-line hard limit. The final
  root file-size rerun is currently blocked by the separately modified
  `SkillStore.tsx` at 1,504 lines.
- Shared and desktop typecheck passed.
- Desktop production build passed. Existing bundle-size and mixed-import Vite
  warnings remain unchanged and do not fail the build.
- Spec governance and change-index checks passed.
