# Design

## Source Of Truth

`packages/db/src/init.ts` owns database opening, the cross-process client lease,
migrations, and integrity gating. Skill install code must not implement a
second database repair path.

## `DES-DBIR-001`: Lease-bound quick check

Run the health gate after `acquireDatabaseClientLease` and before the normal
adapter is assigned to the process singleton. Empty and new files bypass the
gate.

## `DES-DBIR-002`: Narrow atomic repair

Normalize quick-check rows into diagnostic strings. Continue immediately for
`ok`. Only diagnostics matching SQLite's freelist size/count mismatch are
repairable. Close the probe, copy the database to an integrity backup, run
`VACUUM`, close the repair connection, and verify with a fresh read.

## `DES-DBIR-005`: Bounded concurrency wait

The probe and repair connections configure the shared five-second SQLite busy
timeout before preparing `quick_check` or running `VACUUM`. This keeps integrity
validation behind real overlapping writers without weakening the bounded
conflict behavior used by CLI and Desktop callers.

The repair does not delete the backup. SQLite owns `VACUUM` atomicity; PromptHub
does not copy a partially rewritten database over the original.

## `DES-DBIR-003`: Unsupported corruption boundary

Throw a startup error containing only bounded SQLite integrity diagnostics.
Existing recovery UI or maintainer-assisted restore handles broader damage.

## `DES-DBIR-004`: Startup recovery mode

The generic Skill package cleanup keeps its age lease by default because it can
run while operations are active. IPC registration is a process-start boundary:
no package request can be live yet, so it passes an explicit `recoverAll` mode
to reconcile every journal and pending install immediately.

## Traceability

| Requirement   | Design         | Verification    | Task         |
| ------------- | -------------- | --------------- | ------------ |
| `FR-DBIR-001` | `DES-DBIR-001` | `TEST-DBIR-001` | `T-DBIR-001` |
| `FR-DBIR-002` | `DES-DBIR-002` | `TEST-DBIR-001` | `T-DBIR-002` |
| `FR-DBIR-003` | `DES-DBIR-003` | `TEST-DBIR-002` | `T-DBIR-003` |
| `FR-DBIR-004` | `DES-DBIR-004` | `TEST-DBIR-003` | `T-DBIR-005` |
| `FR-DBIR-001` | `DES-DBIR-005` | `TEST-DBIR-004` | `T-DBIR-006` |
