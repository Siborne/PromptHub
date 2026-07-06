# Implementation

## Status

Implementation landed and targeted verification passed.

## Notes

- issue #135 asks for drag-and-drop restore of exported backup archives
- existing backup restore already has a solid preview + confirm flow in `DataSettings`; implementation should reuse that path rather than fork it
- product clarification narrowed the drag-and-drop scope to `Settings > Data > Backup` only; the rest of the app must not react to backup file drags
- added a shared `useBackupImportController()` so file-picker import and backup settings drag-and-drop use the same preview / confirm / restore pipeline
- added a visible drop target in `Settings > Data > Backup`
- `App` only hosts the shared import confirmation dialog; backup file drops are handled solely inside `DataSettings`

## Verification

- `pnpm exec vitest run tests/unit/components/data-settings.test.tsx tests/unit/components/settings-page.test.tsx`
- `pnpm lint`
