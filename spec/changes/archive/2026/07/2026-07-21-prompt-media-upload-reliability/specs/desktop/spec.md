# Desktop Prompt Media Upload Delta

## FR-PMU-001 Visible Native Picker

When a user activates image or video upload from a Prompt editor, PromptHub MUST
open the native file picker as a child of the invoking application window when
that window can be resolved.

### Scenario: Invoking window is available

- **WHEN** the renderer invokes a media picker
- **THEN** the main process resolves the `BrowserWindow` from the IPC sender
- **AND** opens the native dialog with that window as its owner

### Scenario: Invoking window is unavailable

- **WHEN** no owning `BrowserWindow` can be resolved
- **THEN** PromptHub opens the same native picker without a parent
- **AND** preserves the existing result contract

## FR-PMU-002 Explicit Image Selection Failure

Local image selection MUST distinguish cancellation from failure.

### Scenario: User cancels

- **WHEN** the picker returns no selected paths
- **THEN** the editor remains unchanged
- **AND** no error notification is shown

### Scenario: Picker or managed copy fails

- **WHEN** the native bridge throws, is unavailable, or returns no managed image
  after one or more paths were selected
- **THEN** the editor keeps its existing image list
- **AND** shows the localized media upload failure notification

## NFR-PMU-001 Compatibility And Cost

The change MUST retain current IPC channel names, Prompt media filenames, and
database fields. Picker resolution and result handling remain constant-space and
linear only in the number of selected files already processed by the existing
copy operation.
