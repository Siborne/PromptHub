# Desktop Close Choice Persistence

## Status

- Phase: implement
- Status: active
- Reported: 2026-08-20

## Why

Windows users can select **Remember my choice** in the close dialog, choose
minimize or exit, and still receive the same dialog on a later launch. The
shared checkbox also prevented the native input default while driving a
read-only controlled input, so its callback could run without leaving the
visible input checked. Separately, the durable close preference is owned by
canonical renderer settings in the main process. The dialog currently updates
renderer/main memory and immediately performs the close action without awaiting
a durable settings write. Exit can terminate the application before the
asynchronous canonical subscriber publishes the preference.

This is a regression of the user outcome described by closed GitHub issue
`#41`; issue state is not changed by this local fix.

## Scope

- Make the remembered Windows close action durable before minimizing or exiting.
- Use native checkbox change semantics so the checked state remains visible.
- Preserve the existing one-shot behavior when **Remember my choice** is not
  selected.
- Keep the dialog open and restore the previous in-memory action if persistence
  fails.
- Persist the validated close action to canonical renderer settings and the
  SQLite compatibility settings table.
- Add renderer interaction, failure, main IPC, and reload regressions.

## Non-Goals

- No database schema, setting shape, tray behavior, or non-Windows close policy
  change.
- No reopening or editing of GitHub issue `#41`.
- No change to unrelated renderer settings persistence or Rules work.

## Risk And Rollback

- The remembered action keeps the existing `ask | minimize | exit` shape and
  uses the existing atomic canonical publication plus SQLite transaction.
- The action is delayed only by one local IPC round trip and bounded local file
  write; no network I/O is introduced.
- If persistence fails, no minimize/exit result is sent, the previous action is
  restored in renderer and main memory, and the user may retry or proceed
  without remembering.
- Reverting restores the exit-before-persistence race and is not suitable for a
  release claiming remembered close behavior.

## Related Records

- `spec/knowledge/behavior/desktop.md`
- `spec/issues/archive/github-closed.md` (`#41`)
