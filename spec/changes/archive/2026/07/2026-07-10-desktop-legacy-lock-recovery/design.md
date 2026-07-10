# Design: Desktop Legacy Lock Recovery

## Decisions

- `DES-LEGLOCK-001`: add an explicit `recoverUnregisteredLock` initialization
  hook; its default is `false`.
- `DES-LEGLOCK-002`: Desktop passes the hook because main-process database
  initialization occurs after `app.requestSingleInstanceLock()` succeeds.
- `DES-LEGLOCK-003`: recovery remains blocked when any registered client is
  alive or lease ownership cannot be safely determined.

## Traceability

| Requirement                         | Design                | Verification       | Task            |
| ----------------------------------- | --------------------- | ------------------ | --------------- |
| `FR-LEGLOCK-001`                    | `DES-LEGLOCK-001/002` | `TEST-LEGLOCK-001` | `T-LEGLOCK-001` |
| `FR-LEGLOCK-002`, `NFR-LEGLOCK-001` | `DES-LEGLOCK-001/003` | `TEST-LEGLOCK-002` | `T-LEGLOCK-002` |
