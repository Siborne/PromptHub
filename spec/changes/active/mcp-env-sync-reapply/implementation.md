# MCP Env Sync Reapply Implementation

## Status

Implemented on 2026-07-08. The feature is still active until review and archive, but code, tests, typechecks, and the quick release harness have passed.

## What Shipped

- Added `mcp-target-entry-sha256-v1` canonical projected-entry digests in `packages/shared/utils/mcp-config.ts`.
- Extended `McpTargetBinding` with per-server `entryDigests` and normalized legacy records on read.
- Updated MCP apply/remove paths to maintain digest metadata.
- Added `checkServerTargetSync()` and `syncServerToBoundTargets()` to `CoreMcpLibraryService`.
- Implemented the B/L/T reconciliation statuses: `synced`, `needs-sync`, `external-modified`, `conflict`, `missing-target`, `missing-entry`, `parse-error`, `legacy-needs-review`, `skipped-disabled-platform`, and `skipped-server-disabled`.
- Preserved Codex/custom TOML multi-server managed blocks during single-server sync by rewriting the still-managed enabled server set.
- Added `${ENV_NAME}` env-value warning behavior with `UNRESOLVED_ENV_REFERENCE`.
- Added IPC, preload, and renderer store sync methods whose result type excludes full target config content, env values, headers, and token-bearing arguments.
- Added MCP detail UI for target sync checks and one-click sync, with seven-locale copy.
- Synced stable MCP target behavior notes into `spec/knowledge/reference/agent-platforms.md`.

## Review Follow-Up Fixes

- Target-side digests now hash the raw target entry object instead of importing the entry into `McpServerConfig` and projecting it again. Extra target-side fields that PromptHub does not project are detected as external modifications.
- Codex/custom TOML digest projection now matches the serialized TOML entry shape, including `http_headers` for remote entries.
- TOML single-server sync now checks still-managed enabled sibling servers on the same binding before rewriting the managed block. Unsafe sibling states block the write unless the caller explicitly forces conflicts or recreates missing entries.
- Health warning copy for unresolved env references is now English in core service output.

## Review Decisions Applied

- Codex TOML single-server sync must not delete other managed servers.
- Target entry digest canonicalization is shared and deterministic.
- Sync results do not return full target config content or secret-bearing fields.
- Core sync APIs accept `disabledPlatformIds` from renderer/settings instead of importing renderer settings.
- Disabled MCP servers, parse errors, missing targets/entries, and legacy baseline backfill have explicit statuses.

## Verification

- `pnpm --dir apps/desktop exec vitest run tests/unit/services/mcp-config.test.ts tests/unit/main/mcp-library.test.ts tests/unit/stores/mcp.store.test.ts tests/unit/components/mcp-manager.test.tsx`
- `pnpm --dir apps/desktop exec vitest run tests/unit/main/mcp-library.test.ts tests/unit/services/mcp-config.test.ts`
- `pnpm --dir apps/desktop exec vitest run tests/unit/main/mcp-library.test.ts`
- `pnpm --dir apps/desktop exec vitest run tests/unit/components/plugin-manager.test.tsx tests/unit/components/skill-projects-view.test.tsx tests/unit/components/skill-library-import-modal.test.tsx`
- `pnpm --filter @prompthub/shared typecheck`
- `pnpm --filter @prompthub/core typecheck`
- `pnpm --filter @prompthub/desktop typecheck`
- `node -e 'for (const f of ["en","zh","zh-TW","ja","fr","de","es"]) JSON.parse(require("fs").readFileSync(`apps/desktop/src/renderer/i18n/locales/${f}.json`, "utf8")); console.log("locales ok")'`
- `git diff --check`
- `pnpm verify:release:quick`
  - Initial result: passed in 492.2 seconds.
  - Review follow-up result: passed in 706.4 seconds after raw target-entry digest and TOML sibling overwrite fixes.

## Follow-Up

- Secret storage remains unchanged: MCP env values are still stored in the local MCP library JSON. A future secret-vault/keychain design should be scoped separately because it affects import/export, backup, sync, and migration.
