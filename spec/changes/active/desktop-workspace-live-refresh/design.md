# Desktop Workspace Live Refresh Design

<!-- traceability: enforced -->

## `DES-REFRESH-001`: Shared Coordinator

Add a renderer orchestration service that owns a single in-flight Promise and a
monotonic generation. Domain stores expose `prepareRefresh()` reads that return
candidate snapshots without mutating visible state. The coordinator commits
the active workspace projection together, then refreshes independent secondary
domains and reports any partial failure.

Prompt lists continue to use SQLite through existing preload APIs. Skills and
Rules continue to use their existing Core/filesystem owners. The coordinator
does not duplicate durable state or move business logic into React.

## `DES-REFRESH-002`: Revision Probe

Expose a minimal read-only main-process probe containing SQLite
`PRAGMA data_version` and bounded revision tokens for managed filesystem roots.
The renderer stores only the last observed opaque token. Manual refresh always
runs; focus-resume compares the token after a minimum interval and refreshes
only when changed. Direct SQLite writers are therefore detected without a
permanent watcher.

## `DES-REFRESH-003`: Draft And Selection Contract

Editors register a dirty-resource guard with the coordinator. A conflicting
refresh pauses before committing that entity and offers keep draft, discard,
or cancel. Selection is reapplied by stable ID, never by list index. Removed
entities clear detail state and produce a localized toast.

## Failure, Performance, And Cleanup

- Reads are `O(n)` for the active domain and use existing pagination/scanning
  limits; memory is bounded by one current and one candidate page/inventory.
- Duplicate clicks and focus events share one Promise; no retry loop is added.
- Each focus/listener subscription is removed on unmount.
- A failed candidate read leaves the previous state intact and exposes domain,
  reason, and retry action without leaking paths or credentials.

## Analyze Result

- Source of truth stays in each owning SQLite/filesystem domain.
- #199 adds no behavior beyond #198 and is routed as duplicate.
- No blocking design conflict remains; IPC contract work requires a failing
  second-connection integration test first.

## Traceability

| Requirement       | Design                               | Verification                           | Task            |
| ----------------- | ------------------------------------ | -------------------------------------- | --------------- |
| `FR-REFRESH-001`  | `DES-REFRESH-001`                    | `TEST-REFRESH-001`                     | `T-REFRESH-002` |
| `FR-REFRESH-002`  | `DES-REFRESH-001`, `DES-REFRESH-003` | `TEST-REFRESH-002`, `TEST-REFRESH-003` | `T-REFRESH-003` |
| `FR-REFRESH-003`  | `DES-REFRESH-003`                    | `TEST-REFRESH-003`                     | `T-REFRESH-004` |
| `FR-REFRESH-004`  | `DES-REFRESH-002`                    | `TEST-REFRESH-004`                     | `T-REFRESH-005` |
| `NFR-REFRESH-001` | `DES-REFRESH-001`, `DES-REFRESH-002` | `TEST-REFRESH-004`                     | `T-REFRESH-006` |
