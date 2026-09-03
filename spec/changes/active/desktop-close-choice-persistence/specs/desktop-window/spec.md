# Desktop Close Choice Persistence Delta

## Added Requirements

### `FR-CLOSE-001`: Remembered Close Choice Is Durable

When a Windows user selects **Remember my choice** and chooses minimize or exit,
PromptHub MUST persist the selected close action before executing it. A later
window close after restart MUST use the remembered action without showing the
choice dialog again.

#### Scenario: remember minimize

- **Given** close behavior is `ask`
- **When** the user selects remember and chooses minimize
- **Then** `minimize` is durably stored before the window is hidden
- **And** a later close uses minimize without reopening the dialog

#### Scenario: remember exit

- **Given** close behavior is `ask`
- **When** the user selects remember and chooses exit
- **Then** `exit` is durably stored before application shutdown begins
- **And** restart hydrates `exit` from canonical settings

#### Scenario: do not remember

- **When** the user chooses minimize or exit without selecting remember
- **Then** PromptHub performs the one-shot action
- **And** durable close behavior remains `ask`

### `NFR-CLOSE-001`: Persistence Failure Does Not Silently Lose Intent

If the remembered close action cannot be persisted, PromptHub MUST NOT execute
the requested close action as if saving succeeded. The dialog MUST remain
available, report the failure, and restore the prior in-memory action.

#### Scenario: canonical publication fails

- **Given** the user selected remember
- **When** canonical settings publication rejects the close-action write
- **Then** no close-dialog result is sent to the main window lifecycle
- **And** renderer/main memory returns to the previous close action
- **And** the dialog exposes a retryable error

## Acceptance Criteria

- `AC-CLOSE-001`: Clicking the checkbox visibly toggles its checked state.
- `AC-CLOSE-002`: Remembered minimize/exit awaits durable main persistence.
- `AC-CLOSE-003`: Canonical settings and SQLite compatibility settings receive
  the validated action.
- `AC-CLOSE-004`: Failure keeps the dialog open and sends no close action.
- `AC-CLOSE-005`: Existing non-remembered behavior remains unchanged.
