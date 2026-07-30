# Design

## `DES-SQLDR-001`: SQLite Recovery Routing And Validation

- Renderer Data settings classifies dropped files as export archives or
  potential PromptHub SQLite backups.
- The preload `getPathForFile` bridge supplies the user-selected local path.
- Main-process recovery scanning validates SQLite content and returns the
  shared typed `RecoveryCandidate` contract with a structured durable-content
  inventory.
- The existing `DataRecoveryDialog` owns preview, confirmation, pre-recovery
  backup, restore, and restart behavior.

## `DES-SQLDR-002`: Durable Directory Inventory And Merge

No database schema change is introduced. `RecoveryScanOptions`
continues to carry explicitly selected paths; main-process scanning partitions
those paths into directories and regular files. Archive import remains merge
based, while SQLite recovery remains whole-database replacement.

Directory detection inventories known user-facing categories while treating
the whole link-safe `data/` tree as durable, so future business-data folders
are not silently discarded. Recovery merges `data/` and `config/` recursively
without overwriting current files. The shared recovery contract adds optional
content counts so existing callers remain compatible.

## `DES-SQLDR-003`: Explicit Backup Scope And Inventory UI

The file picker and drop target share the same classification boundary. Export
archives continue through merge import, while generated SQLite files enter the
recovery preview. Selective export presents Skill, MCP, and Plugin as separate
controls; full-backup and import summaries enumerate every included durable
category.

Export scope adds independent `mcp` and `plugins` booleans. The existing backup
payload fields remain authoritative: MCP library/files/store sources and Plugin
library/packages/files/store sources are included according to their own
scope, while Skill data remains independent.

## Verification

- `TEST-SQLDR-001`: generated standalone backup filename coverage.
- `TEST-SQLDR-002`: extensionless standalone SQLite restore coverage.
- `TEST-SQLDR-003`: desktop drag routes SQLite files to candidate preview.
- `TEST-SQLDR-004`: MCP/Rule/Plugin/config-only manual directory is detected,
  previewed, and merged without overwriting current files.
- `TEST-SQLDR-005`: locked SQLite preview falls back to durable file inventory.
- `TEST-SQLDR-006`: file selection routes SQLite backups and export scopes keep
  Skill, MCP, and Plugin payloads independent.
- `TEST-SQLDR-007`: full backup and import preview visibly enumerate the actual
  MCP, Plugin, Rule, media, and configuration contents.
- Existing archive drop, symlink rejection, empty candidate, preview, and
  pre-recovery backup tests remain green.

## Traceability

| Requirement    | Design          | Verification                       | Task                                        |
| -------------- | --------------- | ---------------------------------- | ------------------------------------------- |
| `FR-SQLDR-001` | `DES-SQLDR-001` | `TEST-SQLDR-003`                   | `T-SQLDR-001`, `T-SQLDR-003`                |
| `FR-SQLDR-002` | `DES-SQLDR-001` | `TEST-SQLDR-001`                   | `T-SQLDR-001`, `T-SQLDR-002`                |
| `FR-SQLDR-003` | `DES-SQLDR-001` | `TEST-SQLDR-002`                   | `T-SQLDR-001`, `T-SQLDR-002`                |
| `FR-SQLDR-004` | `DES-SQLDR-002` | `TEST-SQLDR-004`                   | `T-SQLDR-007`, `T-SQLDR-008`                |
| `FR-SQLDR-005` | `DES-SQLDR-002` | `TEST-SQLDR-004`, `TEST-SQLDR-005` | `T-SQLDR-007`, `T-SQLDR-008`                |
| `FR-SQLDR-006` | `DES-SQLDR-003` | `TEST-SQLDR-006`, `TEST-SQLDR-007` | `T-SQLDR-007`, `T-SQLDR-009`, `T-SQLDR-010` |
