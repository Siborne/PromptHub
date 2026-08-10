# Implementation

## Status

Completed on 2026-08-10.

## Evidence

- Electron renderer locale observed as `zh-CN`.
- The current SQLite `settings.language` row was observed as `en`.
- Code inspection found that renderer hydration synchronizes its current
  language to main settings, while `loadSettingsFromMainProcess()` omits the
  returned `language` field.

## Verification

- TDD red phase: focused language test failed because hydration included the
  temporary `en` value and main `zh` was ignored.
- Passed: `pnpm --filter @prompthub/desktop exec vitest run tests/unit/stores/settings-language.test.ts tests/unit/stores/settings-startup.test.ts tests/unit/services/i18n-init.test.ts` (19 tests).
- Passed: `pnpm --filter @prompthub/desktop test:i18n` (42 tests).
- Passed: General and language settings component regression tests (9 tests),
  covering the visible language selector and all seven options.
- Passed: focused V8 coverage run for the settings store and persistence module;
  all new and changed statements and branches were exercised. The legacy files'
  aggregate coverage remains below 100% and was not reduced by this change.
- Passed: focused ESLint for the two production files and regression test.
- Passed: `pnpm --filter @prompthub/desktop typecheck`.
- Passed: `pnpm --filter @prompthub/desktop build`.
- Passed: `pnpm --filter @prompthub/desktop bundle:budget`.

## Result

- Raw Zustand persistence is checked before renderer defaults are merged.
- Hydration omits `language` when no supported renderer preference existed.
- Main-process language restores the renderer only in that absent-preference
  case; supported explicit renderer preferences retain precedence.
- Unsupported renderer or main language values do not become durable choices.
- Stable desktop behavior documentation now records the startup precedence.

No process, port, server, browser session, network connection, or persistent
temporary artifact was created. The existing user-run Electron/Vite process was
not restarted or modified. The generated focused coverage directory was
removed after inspection.
