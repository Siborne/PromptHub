# Delta Spec

## Added

- `FR-DSUP-001`: Desktop Skill renderer source files must remain at or below the enforced 1,500-line preferred ceiling unless an existing legacy baseline explicitly permits otherwise.
- `FR-DSUP-002`: Editing the content of a selected Skill file must not rerender the unchanged file-tree subtree on every keystroke.
- `FR-DSUP-003`: Changing local Skill Store search input or operation state must not rerender expensive catalog/detail content when its observable inputs are unchanged.

## Modified

- The Skill file editor, Skill Store, and Skill Store detail surfaces are composed from responsibility-focused renderer components and pure view-model helpers while preserving their current public component APIs.

## Scenarios

- `TEST-DSUP-001`: `pnpm lint:file-size` passes with all three previously failing files below the preferred limit and every new file below 1,000 lines.
- `TEST-DSUP-002`: Existing Skill file editor tests continue to pass for file loading, editing, saving, mutation dialogs, unsaved changes, and resource preview behavior.
- `TEST-DSUP-003`: Existing Skill Store tests continue to pass for remote sources, filtering, pagination/virtualization, install/update/remove, translation, safety, and timer cleanup.
- `TEST-DSUP-004`: Targeted render-isolation tests prove unchanged file-tree/catalog/detail presentation boundaries do not rerender for unrelated high-frequency state.
