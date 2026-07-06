# Design

## Overview

This change adds a renderer-only draft state inside `MainContent` for the selected prompt in card view. The draft mirrors `title` and the user prompt content currently shown to the user. Saving reuses the existing `updatePrompt` store action and only updates the affected fields.

## Affected Areas

- Data model:
  - No schema or shared type changes.
- IPC / API:
  - No new IPC surface. Reuse existing prompt update flow.
- Filesystem / sync:
  - No direct filesystem impact.
- UI / UX:
- Add inline edit controls to the right-hand card-view detail panel, using title double-click as the entry point for the lightweight flow.
  - Keep the existing full edit modal as a separate explicit action.
  - Disable conflicting actions such as language switching, compare, copy, delete, and history while editing inline.

## Tradeoffs

- The inline editor only covers the fastest-edit fields instead of trying to mirror the full modal. This keeps the change small and avoids duplicating complex prompt form behavior.
- When the user is viewing English content, inline editing writes back to `userPromptEn` only if that field already exists. Otherwise it edits the primary `userPrompt`, matching the currently displayed fallback behavior.
