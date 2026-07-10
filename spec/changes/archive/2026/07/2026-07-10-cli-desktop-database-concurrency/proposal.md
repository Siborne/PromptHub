# CLI/Desktop Database Concurrency

## Purpose

Fix GitHub issue #184 without changing SQLite as the local source of truth.
CLI writes must not remove an active Desktop writer lock, and Desktop must
refresh local prompt data when the user returns after CLI activity.

## Scope

- Replace unconditional `.lock` deletion with process-aware client leases.
- Finalize WASM prepared-statement operations so completed writes release their
  VFS lock while Desktop remains open.
- Preserve active locks and recover only locks whose registered owners are dead.
- Add a bounded SQLite busy timeout and a specific CLI conflict error.
- Refresh prompt and folder state when Desktop regains focus or visibility.

## Non-goals

- Replacing `node-sqlite3-wasm` or migrating to a native SQLite dependency.
- Adding a long-running local HTTP server or a new durable data source.
- Continuous background polling while Desktop remains unfocused.

## Risk And Rollback

The lease registry is runtime coordination metadata beside the database, not
user data. Rollback removes the registry and focus refresh, but must not restore
unconditional lock deletion because that can permit concurrent writers.
