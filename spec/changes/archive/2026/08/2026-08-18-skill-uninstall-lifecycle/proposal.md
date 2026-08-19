# Proposal

## Problem

Skill deletion and uninstall behavior is broader than the current UI makes clear.

- PromptHub library deletion already uninstalls platform-distributed skill folders, but the confirmation copy does not explain copy vs symlink consequences.
- The full skill detail page allows global platform uninstall directly through `SkillPlatformPanel`, while older detail surfaces show an explicit uninstall confirmation.
- Project-local removal exists, but the lifecycle needs tests that assert it deletes the project skill folder target rather than only updating UI state.

## Scope

- Add explicit confirmation before global platform uninstall in the full skill detail page.
- Clarify delete confirmation copy for copy/symlink platform distributions.
- Add regression tests for platform uninstall, project removal, and deletion cleanup behavior.

## Non-Goals

- Do not add a new persisted distribution registry in this change.
- Do not change copy/symlink materialization paths.
- Do not delete external source directories when deleting from PromptHub.
