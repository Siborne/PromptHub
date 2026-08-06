# Tasks

- [x] `T-MCP-200` Record issue scope, source-of-truth, compatibility, and rollback boundary; include registered project targets in My MCP projections and regressions.
- [x] `T-MCP-201` Add the Pi target kind, independent global/project presets, generic JSON writer, and compatibility boundary.
- [x] `T-MCP-202` Add reference normalization/rendering, direct/reference forms, health checks, and environment import conversion.
- [x] `T-MCP-203` Apply redaction to MCP preview/apply/remove and backup/sync transport paths while preserving local literals on restore/update.
- [x] `T-MCP-204` Run focused tests, package typechecks, affected lint, spec validation, and diff checks; update stable knowledge and issue-local delivery status.
- [x] `T-MCP-205` Complete `implementation.md`, converge stable docs, and archive the change after verification.

## Verification Identifiers

- `TEST-MCP-200`: My MCP project-target distribution count, distributed filter, and batch target regression.
- `TEST-MCP-201`: Pi global/project preset paths and `mcpServers` JSON root.
- `TEST-MCP-202`: Reference normalization, target-specific rendering, form conversion, health presence/default behavior, and env import conversion.
- `TEST-MCP-203`: Preview/apply/remove, IPC, backup, CLI snapshot, TOML, and redacted restore coverage.
- `TEST-MCP-204`: Package typechecks, affected lint, spec governance, formatting, and diff validation.

## Traceability

| Requirement | Design      | Test                       | Implementation |
| ----------- | ----------- | -------------------------- | -------------- |
| FR-MCP-200  | DES-MCP-200 | TEST-MCP-200, TEST-MCP-204 | T-MCP-200      |
| FR-MCP-201  | DES-MCP-201 | TEST-MCP-201               | T-MCP-201      |
| FR-MCP-202  | DES-MCP-202 | TEST-MCP-202, TEST-MCP-203 | T-MCP-202      |
| FR-MCP-203  | DES-MCP-203 | TEST-MCP-203, TEST-MCP-204 | T-MCP-203      |
