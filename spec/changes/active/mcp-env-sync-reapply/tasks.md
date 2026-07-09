# MCP Env Sync Reapply Tasks

## Documentation

- [x] T-MCP-SYNC-000: Record proposal, delta spec, design, verification strategy, and external review decisions.

## Implementation

- [x] T-MCP-SYNC-001: Add target-entry digest canonicalization helpers and unit tests.
- [x] T-MCP-SYNC-002: Extend `McpTargetBinding` with optional per-server `entryDigests` and migration-safe normalization.
- [x] T-MCP-SYNC-003: Update `CoreMcpLibraryService.apply()` and remove paths to maintain entry digest metadata.
- [x] T-MCP-SYNC-004: Add Codex TOML per-server section replacement or full-managed-set preservation before single-server sync ships.
- [x] T-MCP-SYNC-005: Add pure reconciliation status matrix and core service check method, including parse-error, disabled platform, disabled server, and legacy backfill.
- [x] T-MCP-SYNC-006: Add sync-to-bound-targets service method with safe default skip/block behavior and `disabledPlatformIds` input.
- [x] T-MCP-SYNC-007: Add `${ENV_NAME}` env-value warning behavior to health checks with `UNRESOLVED_ENV_REFERENCE`.
- [x] T-MCP-SYNC-008: Add IPC/preload/store methods for check and sync with redacted result types that never include full config content.
- [x] T-MCP-SYNC-009: Add MCP detail UI summary, sync action, unsafe target review state, and result reporting.
- [x] T-MCP-SYNC-010: Add i18n strings for all user-visible copy in seven locales.
- [x] T-MCP-SYNC-011: Update stable MCP behavior/structure docs after implementation lands.
- [x] T-MCP-SYNC-012: Fix review findings for raw target-entry digest semantics and TOML sibling overwrite protection.

## Verification

- [x] TEST-MCP-SYNC-001: Digest canonicalization unit tests.
- [x] TEST-MCP-SYNC-002: Reconciliation matrix unit tests.
- [x] TEST-MCP-SYNC-003: Safe one-click sync integration tests with real temp target files.
- [x] TEST-MCP-SYNC-004: Conflict/force/backup/unrelated-key preservation tests.
- [x] TEST-MCP-SYNC-005: Disabled platform skip tests.
- [x] TEST-MCP-SYNC-006: Env reference warning tests.
- [x] TEST-MCP-SYNC-007: Renderer store/component tests.
- [x] TEST-MCP-SYNC-008: Codex TOML multi-server preservation tests.
- [x] TEST-MCP-SYNC-009: Parse-error, missing target, missing entry, and disabled server tests.
- [x] TEST-MCP-SYNC-010: Secret non-leakage tests for sync results, store state, UI copy, logs, and snapshots.
- [x] TEST-MCP-SYNC-011: Relevant typecheck and release quick verification.
- [x] TEST-MCP-SYNC-012: Regression tests for JSON raw extra-field detection and TOML managed sibling external modification blocking.

## Resolved Review Decisions

- [x] v1 persists per-target entry digests on bindings.
- [x] v1 keeps existing plaintext local MCP env storage but forbids leaking values through sync results, logs, toasts, or UI summaries.
- [x] `${ENV_NAME}` env values are preserved and warned as unresolved references.
- [x] Sync-all skips disabled platforms by default.
- [x] Default sync updates safe stale targets and lists unsafe targets for per-target review.
- [x] Legacy bindings with `L == T` are automatically backfilled; `L != T` becomes `legacy-needs-review`.
