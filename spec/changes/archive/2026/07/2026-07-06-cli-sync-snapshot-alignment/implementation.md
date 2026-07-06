# Implementation

## Status

Implemented.

## Shipped Changes

- Added `packages/core/src/cli/workspace-sync.ts` as the CLI workspace snapshot boundary.
- Added `packages/core/src/cli/sync-command.ts` as the CLI remote sync HTTP boundary.
- Changed `prompthub workspace export` to write a v2 `prompthub-cli-workspace` bundle with a `SyncSnapshot`-compatible payload.
- Changed `prompthub workspace import` to restore prompts, folders, prompt versions, rules, skills, skill versions, My MCP, My Plugin, managed agent asset files, and available media fields from the snapshot.
- Added `prompthub sync status`, `prompthub sync push`, and `prompthub sync pull` for self-hosted Web and Cloudflare-compatible `/api/sync/*` endpoints.
- Added Cloudflare status fallback from `/api/sync/status` to `/api/sync/manifest`.
- Kept legacy v1 prompt-only workspace import compatibility.
- Made CLI import conflict detection account for file-backed rules, My MCP, and My Plugin data, not only SQLite rows.
- Updated Cloudflare sync normalization so current agent asset fields are preserved instead of dropped.
- Added `mcpServers` and `plugins` counts to Cloudflare sync summaries/manifests and web client sync API types.
- Corrected Kilo Code built-in MCP target paths to `kilo.json` for both global and project presets while leaving JSONC custom paths compatible.

## Verification

- `pnpm --filter @prompthub/cli test -- workspace-sync.test.ts`
- `pnpm --filter @prompthub/web-cloudflare test -- sync.test.ts`
- `pnpm --filter @prompthub/desktop test -- tests/unit/renderer/agent-root-paths.test.ts tests/unit/renderer/mcp-target-presets.test.ts tests/unit/main/mcp-library.test.ts tests/unit/main/skill-installer-utils.test.ts --run`
- `pnpm --filter @prompthub/desktop test -- tests/unit/components/mcp-manager.test.tsx --run`
- `pnpm --filter @prompthub/cli typecheck`
- `pnpm --filter @prompthub/web-cloudflare typecheck`
- `pnpm --filter @prompthub/web typecheck`
- `pnpm --filter @prompthub/desktop typecheck`
- `git diff --check`

All listed checks passed.

## Deferred

Persistent CLI sync login/profile storage is not part of this change. The implemented remote sync commands use explicit `--endpoint` / `--token` options or `PROMPTHUB_SYNC_ENDPOINT` / `PROMPTHUB_SYNC_TOKEN` / `PROMPTHUB_TOKEN`.
