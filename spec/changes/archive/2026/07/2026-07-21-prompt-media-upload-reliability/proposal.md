# Prompt Media Upload Reliability

## Problem

The desktop Prompt editor opens image and video pickers without associating the
native dialog with the Electron window that initiated the request. Depending on
window focus, fullscreen, or multi-window state, the picker can appear behind
PromptHub and make the upload control look unresponsive. Renderer-side picker
and copy failures are also logged only to the console, so the user receives no
visible diagnosis.

## Outcome

- Native media pickers are owned by the invoking PromptHub window when one is
  available, while retaining a safe parentless fallback.
- Canceling the picker remains a quiet no-op.
- Picker, bridge, and managed-copy failures show the existing localized media
  upload error instead of failing silently.
- Existing Prompt media storage and synchronization contracts remain unchanged.

## Scope

- Desktop image/video picker IPC ownership.
- Prompt media manager feedback for local image selection failures.
- Regression tests and stable desktop behavior documentation.

## Non-goals

- Changing supported media formats or size limits.
- Changing Prompt database schema, sync payloads, or media directory layout.
- Deleting unreferenced historical media.

## Risk And Rollback

The change only supplies the sender window to Electron's existing open dialog
and adds renderer error feedback. Rollback is a direct code revert; no persisted
data requires migration or recovery.
