# Desktop Close Choice Persistence Design

<!-- traceability: enforced -->

## `DES-CLOSE-001`: Awaitable Settings Action

The shared Checkbox uses the native input `change` event as its single toggle
source. It no longer cancels the label/input default and then tries to reproduce
checked behavior from a read-only input.

The settings store retains its immediate `setCloseAction()` action for the
General Settings selector and adds `persistCloseAction()` for the close-dialog
commit boundary. The durable action:

1. normalizes and applies the action to renderer/main memory;
2. invokes the main settings persistence contract and awaits completion;
3. restores the previous renderer/main action and rejects if persistence fails.

The close dialog sends `window:closeDialogResult` only after this promise
resolves. While it is pending, action controls are disabled to prevent duplicate
close operations. A rejected write leaves the dialog open with a localized
error. On the next startup, `loadSettingsFromMainProcess()` immediately reapplies
the normalized canonical close action to main memory after hydration; it does
not depend on the earlier default-state theme application.

## `DES-CLOSE-002`: Canonical And Compatibility Persistence

`SETTINGS_SET` recognizes a present `closeAction`, validates the three allowed
values defined by the shared `Settings` contract at the main-process trust
boundary, and, after renderer migration, merges the patch into the current
canonical settings before the existing SQLite transaction runs. Canonical
publication is already atomic. If it rejects, the handler rejects before
reporting success and the dialog rollback path runs. If the subsequent SQLite
compatibility transaction rejects, the handler restores the previous canonical
settings before returning the failure, avoiding a half-remembered choice.

No schema or storage layout changes. Existing settings without `closeAction`
keep current behavior, and pre-migration callers continue using SQLite until the
renderer migration completes.

The SQLite compatibility write is a temporary bridge, not final ownership.
`ADR-20260820-001` fixes `config/app.json` as the durable authority and the
`desktop-settings-authority-convergence` change will remove normal SQLite and
LocalStorage authority after all startup consumers migrate.

The work is `O(S)` time/space for the bounded settings object serialized by the
existing canonical publisher, plus `O(1)` SQLite rows and IPC calls. It adds no
directory scan, unbounded queue, process, port, or network request.

## Verification

- `TEST-CLOSE-001`: Shared Checkbox and CloseDialog controlled-state tests prove
  visible toggling; the dialog then waits for persistence before minimize/exit,
  preserves non-remembered behavior, and exposes failure without sending a
  result.
- `TEST-CLOSE-002`: settings action success, rejection, and restart hydration
  tests prove durable call ordering, renderer/main rollback, and main-memory
  restoration.
- `TEST-CLOSE-003`: main settings IPC tests prove allowlisted canonical merge,
  SQLite compatibility write, pre-migration behavior, and invalid-input refusal.
- `TEST-CLOSE-004`: focused typecheck/lint, spec traceability, file limits, and
  release-risk verification run after the implementation batch.

## Traceability

| Requirement     | Design                           | Verification                       | Task          |
| --------------- | -------------------------------- | ---------------------------------- | ------------- |
| `FR-CLOSE-001`  | `DES-CLOSE-001`, `DES-CLOSE-002` | `TEST-CLOSE-001..004`              | `T-CLOSE-001` |
| `NFR-CLOSE-001` | `DES-CLOSE-001`, `DES-CLOSE-002` | `TEST-CLOSE-001`, `TEST-CLOSE-002` | `T-CLOSE-002` |
