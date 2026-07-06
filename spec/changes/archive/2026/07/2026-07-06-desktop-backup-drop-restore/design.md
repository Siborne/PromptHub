# Design

## Summary

Promote backup import preview / confirm state to a shared controller so `DataSettings` can initiate restore while `App` hosts a single confirmation dialog instance.

## Modules

- `apps/desktop/src/renderer/App.tsx`
  - host the shared import preview / confirm state
- `apps/desktop/src/renderer/components/settings/DataSettings.tsx`
  - consume shared restore callbacks instead of owning its own import-preview state
  - add a backup drag target panel in the backup subsection
- `apps/desktop/src/renderer/services/database-backup.ts`
  - reuse existing `previewImportFile` and `restoreFromFile`

## Interaction Model

- only supported backup extensions are accepted
- dropping a valid file inside the backup settings drag target opens the same import preview confirmation already used by the file picker
- confirm import still creates a safety backup first, then restores, then reloads the app

## Validation

- unit tests for `DataSettings` drag-and-drop restore trigger
- unit tests for the shared restore flow where feasible
- targeted desktop lint + tests
