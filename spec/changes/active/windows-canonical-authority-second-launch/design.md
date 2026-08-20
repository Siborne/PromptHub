# Windows Canonical Authority Second-Launch Design

<!-- traceability: enforced -->

## `DES-WINCAT-001`: Bounded Same-Directory SQLite Temporaries

`stagePromptCanonicalDatabase()` currently derives its stage from the full
destination basename. A UUID-bearing destination therefore becomes a second,
longer UUID-bearing stage name.

The canonical projector first assigns its verification database a bounded
`.canonical-catalog-<uuid>.db` sibling instead of appending a catalog suffix to
the full checkpoint path. The catalog builder then uses
`.catalog-stage-<uuid>.db` for its atomic stage:

- full UUID collision resistance
- fixed basenames below 64 characters, independent of checkpoint and
  destination basenames
- same parent directory as the destination
- unchanged create, verify, rename, and SQLite sidecar cleanup sequence

Startup and selected-database recovery checkpoint targets both use
`.canonical-checkpoint-<uuid>`, and `createCanonicalStorageCheckpoint()` uses
`.checkpoint-stage-<uuid>` in the same parent. This removes the earlier
target-basename duplication from every ancestor of the temporary SQLite
catalogs and avoids reintroducing a longer recovery-only ancestor. With the
release smoke's long Windows runner profile, the resulting database and `.lock`
paths retain explicit headroom below the VFS limit rather than relying on a
short leaf name inside an already overlong directory.

Naming is `O(1)` time and space. Catalog construction remains `O(B + R)` for
canonical bytes and records; no additional scan, copy, database open, or
network request is introduced.

## `DES-WINCAT-002`: Clean Two-Launch Packaged Smoke

The release smoke keeps one isolated AppData root for two packaged launches.
It uses a deliberately long runner-owned directory name so the old duplicated
stage basename crosses the Windows VFS budget while the shortened name remains
within it.

The main process accepts an auto-exit flag only when the existing validated
packaged Windows CI AppData override is active. Window loading alone does not
prove that the renderer has invoked and completed its persistence migration.
The release profile therefore uses a two-signal barrier: one signal is emitted
after `startup:window_ready`, and the other is emitted by the successful
renderer-persistence IPC migration handler after its durable marker and legacy
secret scrubbing complete. Only then does the test process schedule normal
`app.quit()`, allowing the existing `before-quit` database cleanup to run. A
missing signal or clean exit is bounded and fails before the second launch;
task-owned force termination remains only the failure cleanup.

The smoke reads only events appended by each launch:

1. First launch requires the upgrade safety snapshot,
   `waiting-renderer-migration`, `startup:window_ready`, and renderer
   persistence status `migrated` before clean exit.
2. Second launch requires canonical authority `published`,
   `startup:window_ready`, and renderer persistence status `already-complete`.
3. Either launch fails immediately on the existing startup failure events,
   early process exit, or the 60-second deadline.

The second launch doubles only this bounded Windows x64 startup step. Captured
output, diagnostic files, polling interval, process cleanup, and root cleanup
remain bounded by the existing limits.

The smoke `main()` remains a 65-line linear orchestration function so one
`try/finally` visibly owns the temporary profile across both launches. Process
spawn/wait/diagnostics are already extracted into sub-50-line helpers; splitting
the remaining environment and two ordered calls would obscure the single
cleanup lifetime without removing repeated complexity. Static contract tests
cover its two calls and distinct event expectations; the real Windows job is
the required black-box coverage.

## Verification Strategy

- `TEST-WINCAT-001`: Core and Desktop filesystem/SQLite regressions capture the
  verification database and actual stage used for long checkpoint/catalog
  destinations, including startup/recovery checkpoint targets and the
  checkpoint directory stage, and assert basename budgets, sibling placement,
  target independence, successful publication, and existing failure cleanup.
- `TEST-WINCAT-002`: Desktop unit/contract tests cover the release-only auto-exit
  guard, both signal orders, exactly-once exit, migration failure behavior, two
  launches, per-launch event boundaries, clean exit, and workflow blocking
  placement.
- `TEST-WINCAT-003`: A real Windows x64 tag/manual release workflow must pass
  the packaged two-launch smoke. Local non-Windows tests cannot replace this
  platform evidence.

## Traceability

| Requirement      | Design           | Verification                         | Task           |
| ---------------- | ---------------- | ------------------------------------ | -------------- |
| `FR-WINCAT-001`  | `DES-WINCAT-002` | `TEST-WINCAT-002`, `TEST-WINCAT-003` | `T-WINCAT-002` |
| `NFR-WINCAT-001` | `DES-WINCAT-001` | `TEST-WINCAT-001`                    | `T-WINCAT-001` |
| `FR-WINCAT-002`  | `DES-WINCAT-002` | `TEST-WINCAT-002`, `TEST-WINCAT-003` | `T-WINCAT-002` |
