# MCP Env Sync Reapply Proposal

## Why

Users expect an MCP server configured in PromptHub to remain the source record after it has been distributed to multiple agent platforms. Today, when a token or environment value changes, users may need to manually reinstall or reapply the MCP config to every target agent. This is especially painful for authentication values such as `MINERU_TOKEN`, where a user reasonably expects one edit in PromptHub to propagate to Claude, Codex, Cursor, WorkBuddy, and other configured targets.

The common workaround of writing `${MINERU_TOKEN}` into MCP config is not reliable enough as the default behavior. Agent platforms differ in whether they expand shell variables from JSON/TOML config files, and macOS GUI applications often do not inherit the user's shell environment. PromptHub should therefore treat MCP env values as PromptHub-managed server configuration and provide a deliberate "sync/reapply" workflow for already distributed targets.

## Scope

In scope:

- Define how PromptHub detects whether a distributed MCP server target is in sync with the current local MCP library record.
- Add a one-click workflow to reapply one MCP server to every previously distributed target.
- Preserve the current safe apply boundary: only managed MCP server entries may be overwritten, unrelated target config must remain untouched, and backups/atomic writes are still required.
- Define legacy binding behavior for target bindings that do not yet have per-server apply fingerprints.
- Define how literal env values and variable-reference strings such as `${MINERU_TOKEN}` should be presented and validated.

Out of scope for v1:

- Creating a system-wide environment variable manager.
- Mutating the OS process environment, login shell startup files, launchd environment, or platform-specific keychains.
- Live provider authentication checks.
- Encrypting or moving MCP secrets into a dedicated secret vault. This may become a separate follow-up if the current plain local MCP library storage is deemed insufficient.
- Automatically syncing every target immediately after every edit without user confirmation.

## User Impact

- A user edits a token once in the MCP detail page.
- PromptHub shows which already distributed platforms are now stale or divergent.
- The user can click "Sync distributed targets" to reapply the updated MCP server to all previously bound targets.
- If an external agent config was manually changed, PromptHub warns before overwriting and can skip or require confirmation.

## Current Boundary

Existing MCP management already has useful primitives:

- `packages/core/src/mcp-library.ts` stores the local MCP library in `data/mcp/library.json`.
- `McpTargetBinding` records which server IDs were applied to which target path.
- `CoreMcpLibraryService.apply()` safely merges MCP server entries into target config files.
- `refreshTargetStatus()` scans target config files and reports present server names.
- `importEnvForServer()` can fill server-level env values from `.env`.

The missing piece is a reconciliation layer that compares the current PromptHub server record, the last applied target projection, and the actual target file entry.

## Risks

- Existing bindings do not have a per-server baseline digest, so initial reconciliation must be conservative.
- Some target config formats have different projected shapes for the same server, so fingerprints must be target-entry based, not only server-record based.
- Secrets stored in the MCP library are currently local plaintext user data. This proposal does not solve secret-at-rest encryption.
- Blindly syncing over externally edited target entries could destroy a user's manual config, so divergence must be surfaced.
- Codex TOML currently has managed-block behavior in the apply path. Sync must not rewrite a single server by replacing the whole managed block and thereby delete other managed servers on the same target.
- Sync results must not return full target config content because MCP target entries can contain tokens or other secrets.

## Rollback Thinking

The feature can be rolled back by hiding the sync/reapply UI and ignoring any new optional binding fingerprint fields. Existing target configs remain valid because the apply format does not change. Optional binding metadata must be backward compatible and omitted safely by older builds.

## Review Questions

1. Should v1 store per-target projected entry digests on `McpTargetBinding`, or should it recompute everything from target files without persisting a baseline?
2. Is local plaintext storage for MCP env values acceptable for this v1, given it matches the existing MCP library behavior?
3. Should `${ENV_NAME}` values be treated as unresolved references with warnings, or as accepted literal strings with no special status?
4. Should "sync all distributed targets" skip disabled platforms by default even if a historical binding exists?
5. Should external target divergence default to skip, block all, or offer per-target overwrite confirmation?

## Review Decisions

- v1 MUST persist per-target projected entry digests. Without a baseline, PromptHub cannot reliably distinguish a local MCP edit from an external target edit.
- Existing plaintext local MCP env storage is acceptable for v1 because it matches current MCP library semantics, but sync APIs, UI, logs, toast messages, and tests MUST NOT expose secret values.
- `${ENV_NAME}` values are preserved exactly and treated as unresolved-reference warnings, not as validated authentication values.
- Sync-all MUST skip disabled platforms by default. Advanced callers may pass an explicit override.
- Default sync SHOULD update safe `needs-sync` targets and skip unsafe targets, then present unsafe targets for per-target review instead of blocking all safe writes.
