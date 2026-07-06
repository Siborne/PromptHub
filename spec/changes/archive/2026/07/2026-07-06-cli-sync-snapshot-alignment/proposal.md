# Proposal

## Problem

PromptHub 0.5.9 beta has aligned the published CLI version string with the desktop release, but the CLI workspace export/import and Cloudflare sync backend still do not preserve the same logical snapshot as desktop backup and self-hosted Web sync.

Current drift:

- CLI `workspace export/import` only covers prompts, folders, and prompt versions.
- Cloudflare sync normalizes away current-format agent asset fields such as My MCP, My Plugin, plugin package files, store sources, and managed agent asset file snapshots.
- Web client API types still expose older sync summaries that omit rules, MCP, and plugin counts in some places.

## Scope

This change aligns the local snapshot contract across:

- standalone CLI workspace export/import
- Cloudflare sync storage and manifest summaries
- web client sync API summary types

## Non-Goals

- This change does not introduce the full remote CLI command surface (`prompthub sync login/status/push/pull`). That is a larger command UX and credential-storage change and remains a known CLI gap.
- This change does not attempt to read desktop renderer `localStorage` custom store-source state from CLI. CLI can only export durable database and filesystem state available from shared core paths.

## Risks

- Expanding CLI workspace import increases the blast radius of `--force-clear`.
- Cloudflare persisted snapshots may contain fields older clients ignore; this is intentional and keeps future restore data intact.

## Rollback

- CLI still accepts the legacy `prompthub-cli-workspace` bundle shape for import.
- Cloudflare `normalizeSnapshot()` continues to fill missing arrays for older payloads.
