# Proposal

## Summary

Add a low-risk inline edit flow for the desktop card-view detail panel so users can quickly adjust the selected prompt title and visible user prompt without leaving the current workspace context.

## Why

- The current card-view detail panel is optimized for reading, but even small copy fixes force users into the full edit modal.
- The user specifically asked for a smoother edit experience in the large title and user-prompt area on the right-hand detail panel, with title double-click as the entry point instead of a separate large button.
- A minimal inline edit path can improve iteration speed while preserving the existing full edit modal for broader changes.

## Scope

### In Scope

- Add inline editing for `title` and the currently visible `userPrompt` content in the desktop card-view detail panel.
- Keep the existing `EditPromptModal` available as the full editor entry point.
- Prevent conflicting actions while an inline draft is open.
- Add regression coverage for save and cancel flows.

### Out Of Scope

- Editing description, tags, system prompt, notes, images, or folder assignment inline.
- Reworking list, gallery, or kanban prompt editing UX.
- Changing prompt persistence or versioning semantics.

## Risks

- The visible-language toggle could cause users to edit a different prompt field than expected if the behavior is not constrained carefully.
- Inline draft state could get out of sync with store updates if selection or language changes are not handled explicitly.

## Rollback / Fallback

- Remove the inline draft controls and return to the existing modal-only edit path while keeping the underlying prompt update APIs unchanged.
