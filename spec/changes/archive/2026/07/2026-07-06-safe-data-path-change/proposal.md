# Safe Data Path Change

## Why

Changing the desktop data directory currently performs a migration into the selected path. If that path already contains copied PromptHub data from another computer, the current machine's empty or newer files can overwrite the copied data.

## Scope

- Detect existing PromptHub data before writing to a selected data directory.
- Let users switch to an existing data directory without copying files.
- Keep destructive overwrite available only after explicit confirmation and a target backup.

## Risks

- Existing users may expect the old single-step migration. The new flow keeps the empty-directory migration path unchanged.
- Target backups can be large because they snapshot the existing selected directory before overwrite.

