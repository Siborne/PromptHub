# Windows Canonical Authority Second Launch

## Status

- Phase: verify
- Status: release-pending
- Reported: 2026-08-20

## Why

A Windows user installed `0.6.0-beta.1` over an existing PromptHub install. The
first launch succeeded, but after a normal exit the second launch stopped in
the startup error dialog with `SQLite3Error: Could not open the database`. The
failing path was a canonical catalog SQLite stage ending in
`.db.stage-<pid>-<uuid>`.

The first launch can legitimately defer canonical authority publication until
the renderer persistence marker exists. The second launch then creates the
canonical checkpoint and its verification catalog. The current SQLite stage
name repeats the already long destination basename and appends another PID and
UUID. `node-sqlite3-wasm` advertises a 260-character Windows VFS path limit, so
the second-launch stage can exceed the path budget even though the operational
`data/prompthub.db` path is valid.

The packaged Windows release smoke currently proves only the first upgraded
launch. It stops the process and deletes the isolated profile, so it cannot
detect a failure that appears when the same profile is opened again.

## Scope

- Keep canonical SQLite verification and stage filenames short and independent
  of the checkpoint/destination basename while preserving same-directory
  publication and atomic rename.
- Keep the checkpoint target and its pre-publication directory stage bounded as
  well; a short SQLite basename is insufficient when an internally amplified
  parent path already consumes the Windows VFS budget.
- Preserve existing stage cleanup for create, quick-check, graph-hash, and
  destination-race failures.
- Extend the packaged Windows x64 upgrade smoke to launch the same isolated
  `0.5.9` profile twice.
- Make release-smoke auto-exit available only inside the existing packaged
  Windows CI profile, and release the first process only after both the window
  and renderer persistence migration have completed, so both launches close
  the database cleanly without racing the migration marker.
- Require the first launch to reach the renderer migration handoff and the
  second launch to publish canonical authority and load its renderer.

## Non-Goals

- No database schema, canonical resource format, user-data layout, migration,
  or recovery-selection change.
- No broad Windows long-path opt-in or replacement of `node-sqlite3-wasm`.
- No deletion or repair of user files from the reported machine.
- No relaxation of quick-check, hash, journal, rollback, or database-client
  lease gates.

## Risk And Rollback

- Shorter random verification and stage siblings remain on the same filesystem
  as their owners, and the stage is renamed atomically exactly as before.
  Collision resistance continues to use full UUIDs.
- Release-smoke auto-exit is fail-closed behind packaged Windows, CI, and the
  existing runner-owned AppData override. It is additionally gated by an
  in-process two-signal barrier for window readiness and durable renderer
  migration completion. Production launches cannot activate it accidentally.
- The two-launch smoke adds one bounded packaged startup to the Windows x64 CI
  job; it does not add unbounded polling or background services.
- Rollback restores the old stage name and single-launch smoke, which also
  restores the reported release defect and is therefore not release-safe.

## Related Records

- `spec/changes/archive/2026/08/2026-08-19-windows-packaged-upgrade-startup-gate/`
- `spec/changes/active/desktop-upgrade-snapshot-lock-recovery/`
- `spec/knowledge/behavior/data-recovery.md`
