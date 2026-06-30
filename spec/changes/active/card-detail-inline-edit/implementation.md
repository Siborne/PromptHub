# Implementation

## Summary

Added a lightweight inline edit flow to the desktop card-view detail panel so users can update the selected prompt title and visible user prompt without leaving the reading context.

## Delivered Changes

- Added renderer-local draft state in `apps/desktop/src/renderer/components/layout/MainContent.tsx` for card-view detail editing.
- Replaced the temporary large inline-edit button with title double-click so the entry matches the existing detail-panel visual language.
- Reused the existing `updatePrompt` store action to save `title` and the currently visible user-prompt field.
- Preserved user-prompt text exactly on inline save while still rejecting empty/whitespace-only drafts.
- Kept the full `EditPromptModal` entry point available as a separate action for broader edits.
- Disabled conflicting detail actions such as language switching, copy, compare, history, and delete while an inline draft is active.
- Added a focused integration test file covering both save and cancel flows for the inline editor.
- Added `toast.updateFailed` to all 7 desktop locale files so inline save failures remain localized.
- Isolated the IDB migration IPC regression test to a temporary user-data directory so full-suite runs do not write into the real desktop profile path.
- Follow-up: double-clicking a prompt card in the left card list now opens the selected prompt's inline title editor.
- Follow-up: inline edit save/cancel actions now live in the bottom sticky action bar instead of the title action cluster.

## Verification

- `pnpm --filter @prompthub/desktop test:run tests/integration/components/main-content-inline-edit.integration.test.tsx`
- `pnpm --filter @prompthub/desktop test:run tests/unit/main/prompt-ipc-idb-migration.test.ts`
- `pnpm --filter @prompthub/desktop lint`
- `pnpm --filter @prompthub/desktop typecheck`
- `pnpm --filter @prompthub/desktop test:run`
- `pnpm --dir apps/desktop test:run tests/integration/components/main-content-inline-edit.integration.test.tsx`
- `pnpm --filter @prompthub/desktop typecheck`

## Synced Docs

- Synced the active change records under `spec/changes/active/card-detail-inline-edit/`.
- Synced durable desktop behavior into `spec/knowledge/behavior/desktop.md`.

## Follow-Ups

- Evaluate whether system prompt or bilingual fields also need an inline edit path after the lightweight flow proves stable.
