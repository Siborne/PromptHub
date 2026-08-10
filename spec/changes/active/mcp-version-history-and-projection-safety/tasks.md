# Tasks

## Foundation

- [ ] `T-MCPVER-001` Add failing migration and reload tests for existing
      version-1 MCP libraries, then define shared version contracts.
- [ ] `T-MCPVER-002` Implement per-server history storage, normalization,
      owner-only permissions, semantic digests, pagination, and lazy detail
      reads.
- [ ] `T-MCPVER-003` Implement the single mutation coordinator, transient
      metadata journal, verification, recovery, manual snapshot, restore,
      note-update, and historical delete behavior.

## Projection And Conflict Safety

- [x] `T-MCPVER-004` Add failing apply/remove/sync tests, then replace persistent
      target backups with no-op detection, atomic replacement, post-write
      verification, exact in-process rollback, and temporary-file cleanup.
- [ ] `T-MCPVER-005` Add entry-level external conflict diff/import/overwrite
      flows without copying unrelated target configuration into history.

## Product Surfaces

- [ ] `T-MCPVER-006` Add Desktop and CLI version list/detail/diff/create/restore/
      delete workflows with loading, empty, conflict, and failure states.
- [ ] `T-MCPVER-007` Add allowlisted legacy-sidecar scan, preview, revalidation,
      and confirmation-based cleanup; never auto-delete or follow symlinks.

## Integration And Gates

- [ ] `T-MCPVER-008` Add pagination and stress fixtures for large MCP inventories
      and per-server histories; record elapsed time, memory assumptions, and I/O
      counts.
- [ ] `T-MCPVER-009` Extend backup/sync/export redaction and restore tests for
      MCP version indexes and snapshots.
- [x] `T-MCPVER-010` Deprecate `backupPath` in shared contracts and user-visible
      outputs while keeping compatibility readers.
- [ ] `T-MCPVER-011` Run focused tests, Core/Shared/Desktop/CLI typechecks,
      changed-module coverage, filesystem adversarial tests, file-size checks,
      `pnpm verify:changed`, and UI interaction verification.
- [ ] `T-MCPVER-012` Converge stable MCP knowledge, issue #203 local status,
      sync/backup docs, release notes when applicable, and archive the change.
