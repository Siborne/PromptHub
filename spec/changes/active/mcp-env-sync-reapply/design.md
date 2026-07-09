# MCP Env Sync Reapply Design

## Summary

This change adds a reconciliation and reapply layer on top of the existing MCP management service. PromptHub remains the source record for each MCP server, including env values. Target agent config files remain external projections. The new layer compares:

- **B: Baseline** — the last PromptHub-applied target entry digest recorded in `McpTargetBinding`
- **L: Local** — the current PromptHub MCP server projected into the selected target format
- **T: Target** — the current entry read from the external target config file

This is intentionally similar to the Skill source update reconciliation model, but scoped to MCP target projections rather than package directories.

## DES-MCP-SYNC-001: Target Entry Digest

Add a deterministic digest for a single projected MCP target entry.

Recommended helper:

```ts
type McpTargetEntryDigestAlgorithm = "mcp-target-entry-sha256-v1";

interface McpTargetEntryDigest {
  algorithm: McpTargetEntryDigestAlgorithm;
  digest: string;
  serverName: string;
  recordedAt: number;
}
```

The digest input should be the canonical JSON representation of the target-specific entry object for one server, after applying the existing projection rules:

- Codex/custom TOML: digest the target-entry object before TOML serialization, not raw TOML text.
- JSON targets: digest the server entry object under `mcpServers`, `servers`, or `mcp`.
- OpenCode/Kilo: digest their target-specific `type`, `command`, `environment`, `url`, and `headers` entry shape.

Canonicalization rules:

- Use a single shared `computeMcpTargetEntryDigest(target, entryObject)` implementation.
- Normalize by recursively removing keys whose value is `undefined`.
- Keep explicit `null` values because target entry content may intentionally contain them.
- Sort object keys by Unicode code point order with `Array.prototype.sort()` on raw key strings.
- Preserve every array order because command args and other target arrays are ordered.
- Recursively canonicalize objects inside arrays.
- Serialize the canonical value with `JSON.stringify`.
- Hash the UTF-8 serialized bytes with SHA-256 and prefix/store the algorithm as `mcp-target-entry-sha256-v1`.
- Do not include unrelated target file keys.
- Do not include backup path, timestamps, UI labels, or binding metadata.

Reference fixture:

```ts
const entry = { env: undefined, args: ["a", "b"], command: "npx" };
canonicalJson(entry) === '{"args":["a","b"],"command":"npx"}';
```

Target-specific notes:

- Codex TOML target entries are digested as the root server entry object, not raw TOML text. TOML whitespace, quoting style, and line endings must not affect the digest.
- OpenCode and Kilo use their target-specific entry shape, including `type`, command array, `environment`, remote `url`, `headers`, and `enabled` fields.
- Extra target-side fields that PromptHub does not project are treated as external modification for v1. They are not silently ignored.

## DES-MCP-SYNC-002: Binding Baseline Metadata

Extend `McpTargetBinding` with optional per-server apply baseline metadata:

```ts
interface McpTargetBinding {
  // existing fields...
  entryDigests?: Record<string, McpTargetEntryDigest>;
}
```

Keyed by `serverId`, the digest records the last PromptHub-applied projected entry for that server on that specific target. This field is optional for backward compatibility. Older bindings without this metadata are treated as legacy bindings.

Apply updates:

- `CoreMcpLibraryService.apply()` computes and stores a digest for every successfully applied server ID.
- Re-applying a subset of servers updates those server IDs in `entryDigests`. If a target writer rewrites additional managed servers, it must refresh the digest for every managed server whose target entry was rewritten.
- Removing a server from a target removes that server ID from both `serverIds` and `entryDigests`.
- If a binding has no remaining `serverIds`, the binding is removed as today.

## DES-MCP-SYNC-003: Reconciliation Status

Introduce a pure reconciliation result type:

```ts
type McpTargetSyncStatus =
  | "synced"
  | "needs-sync"
  | "external-modified"
  | "conflict"
  | "missing-target"
  | "missing-entry"
  | "parse-error"
  | "legacy-needs-review"
  | "skipped-disabled-platform"
  | "skipped-server-disabled";

interface McpTargetSyncCheck {
  bindingId: string;
  presetId?: string;
  target: McpTargetKind;
  scope: McpTargetScope;
  path: string;
  serverId: string;
  serverName: string;
  status: McpTargetSyncStatus;
  safeToReapply: boolean;
  baselineDigest?: string;
  currentDigest?: string;
  targetDigest?: string;
  reason: string;
}
```

Status matrix:

| Condition | Status | Safe default action |
| --- | --- | --- |
| `B == L == T` | `synced` | None |
| `B == T`, `L != B` | `needs-sync` | Reapply |
| `B == L`, `T != B` | `external-modified` | Skip / ask |
| `B != L`, `B != T`, `L != T` | `conflict` | Block / ask |
| target file missing | `missing-target` | Ask before recreate |
| target file exists but server entry missing | `missing-entry` | Ask before recreate |
| target file cannot be parsed | `parse-error` | Skip / ask after repair |
| local server disabled | `skipped-server-disabled` | Skip |
| no `B`, `L == T` | `synced` | Backfill baseline |
| no `B`, `L != T` | `legacy-needs-review` | Skip / ask |
| platform disabled | `skipped-disabled-platform` | Skip |

If `L == T` but `B` differs or is missing, PromptHub MUST update the binding baseline without rewriting the target file because the target already matches the current projection.

Disabled MCP servers are not projected by existing target builders. v1 treats disabled servers with existing bindings as skipped, not as a removal operation. Users must use the existing remove-from-target workflow when they want to uninstall an MCP entry from a target file.

## DES-MCP-SYNC-004: Reapply Service

Add service methods to `CoreMcpLibraryService`:

```ts
checkServerTargetSync(serverIdOrName: string): McpTargetSyncCheck[];

syncServerToBoundTargets(
  serverIdOrName: string,
  options?: {
    disabledPlatformIds?: string[];
    includeDisabled?: boolean;
    recreateMissing?: boolean;
    forceConflicts?: boolean;
    targetBindingIds?: string[];
  },
): McpTargetSyncApplyResult;
```

The sync method should:

1. Read the current library and matching server.
2. Build reconciliation checks from current bindings.
3. Select safe targets by default: `needs-sync`.
4. Skip disabled platforms from `disabledPlatformIds` unless `includeDisabled` is explicitly true.
5. Skip disabled MCP servers; do not call `apply()` and do not auto-remove old target entries.
6. Skip `external-modified`, `conflict`, `missing-target`, `missing-entry`, `parse-error`, and `legacy-needs-review` unless a caller explicitly chooses the relevant override.
7. Reuse the existing safe apply flow for each target so backups, merge preservation, conflict detection, and atomic writes remain centralized.
8. Update digest metadata only after each successful target write.
9. Return per-target results including updated, skipped, blocked, failed, and backup paths.

This must not bypass `apply()`. If `apply()` needs a lower-level option to update digest metadata correctly, extend it there rather than writing a separate target-file writer.

Sync result types MUST NOT include full target file content. The existing `McpApplyResult.content` is acceptable for preview/apply flows that intentionally show generated config, but the new sync API must return redacted structural results only:

```ts
interface McpTargetSyncApplyResult {
  updated: McpTargetSyncUpdated[];
  skipped: McpTargetSyncSkipped[];
  blocked: McpTargetSyncBlocked[];
  failed: McpTargetSyncFailed[];
}
```

Each item may include target kind, scope, path, preset id, server name, status, reason, and backup path. It must not include `content`, `env`, `headers`, or token-bearing arguments.

### Codex TOML single-server safety

Codex TOML needs a special write path before one-click sync ships. Syncing server A must not delete server B from the same target. v1 MUST satisfy one of these safe strategies before implementation is considered complete:

1. Implement per-server TOML section replacement that removes/replaces only `[mcp_servers.<name>]` and its child sections for the selected server while preserving unrelated server sections; or
2. When a TOML target writer still uses a whole managed block, always rewrite the complete set of still-managed, enabled server IDs for that target and refresh baselines for every server rewritten.

The preferred strategy is per-server section replacement because it localizes the sync operation and avoids relying on full managed-block reconstruction. Tests must cover two managed servers in the same Codex target and prove syncing one does not remove the other.

If v1 uses strategy 2, the sync service must classify every still-managed enabled sibling server in the same TOML binding before writing. Any sibling in `external-modified`, `conflict`, `legacy-needs-review`, `parse-error`, or another unsafe state blocks the whole managed-block rewrite unless the caller explicitly chooses the matching override. This prevents syncing server A from silently overwriting a user edit made to server B in the same TOML block.

## DES-MCP-SYNC-005: Env Value Policy

PromptHub v1 uses MCP server `env` as literal server-level configuration. The UI should encourage users to paste actual token values into PromptHub when they expect PromptHub to distribute working target configs.

Variable references such as `${MINERU_TOKEN}` are preserved, but treated as an advanced/manual compatibility mode:

- In `args`, `url`, and `headers`, `${NAME}` continues to be inferred as an env requirement.
- In `env` values, `${NAME}` produces a static `UNRESOLVED_ENV_REFERENCE` warning because many targets will not expand it.
- Health checks should distinguish "literal value present" from "reference string present".
- PromptHub must not write to OS environment variables or shell profiles.

Security note: the existing local MCP library stores env values as user-data JSON. This proposal does not change storage-at-rest semantics. If reviewers require encrypted secret storage, that should become a separate blocking design change because it affects import/export, sync, backup, and migration.

## DES-MCP-SYNC-006: Renderer UX

MCP detail page:

- Add a distribution sync summary near the existing platform distribution panel.
- Show counts: synced, needs sync, externally modified, conflict, missing, skipped.
- Show "Sync distributed targets" when safe stale targets exist.
- Show a review drawer/dialog when unsafe targets exist.

Suggested copy:

- Button: `Sync distributed targets`
- Safe stale description: `This MCP changed in PromptHub after it was distributed. Sync will reapply the current config to the selected targets.`
- Env reference warning: `Many agents do not expand ${ENV_NAME} inside MCP config files. For reliable sync, save the actual value in PromptHub or confirm the target supports env expansion.`
- Conflict description: `This target was changed outside PromptHub. Review before overwriting.`

The UI should not expose full secret values in status chips, logs, or toast messages.

The UI must not set sync results into config preview fields. Sync results are operational summaries, not generated config previews.

## DES-MCP-SYNC-007: IPC And Preload Boundary

Add typed IPC/preload/store methods rather than letting renderer inspect filesystem targets directly:

- `mcp:check-server-target-sync`
- `mcp:sync-server-targets`

Renderer should receive structured results only. Main/core continues to own filesystem reads/writes, backups, parsing, and digest calculation.

IPC handlers must validate:

- non-empty server identifier
- optional boolean flags
- optional string array `disabledPlatformIds`
- optional target binding id array

Handler errors should be converted into structured failures where possible so one bad target does not crash the main process or erase successful target results.

## Verification Strategy

- `TEST-MCP-SYNC-001`: pure digest canonicalization tests for object key order, target-specific entry shape, and array order.
- `TEST-MCP-SYNC-002`: reconciliation status matrix for `synced`, `needs-sync`, `external-modified`, `conflict`, missing target, missing entry, and legacy binding.
- `TEST-MCP-SYNC-003`: core service reapply writes only safe stale targets by default and updates digest metadata after success.
- `TEST-MCP-SYNC-004`: forced conflict sync creates backups and preserves unrelated target config keys.
- `TEST-MCP-SYNC-005`: disabled platform bindings are skipped by default.
- `TEST-MCP-SYNC-006`: `${MINERU_TOKEN}` in env values produces a warning/static issue without claiming live auth success.
- `TEST-MCP-SYNC-007`: renderer store/component tests for counts, sync button state, and result reporting without leaking secret values.
- `TEST-MCP-SYNC-008`: Codex TOML sync of one managed server preserves other managed server sections on the same target.
- `TEST-MCP-SYNC-009`: parse-error target files are reported without creating backups or modifying files.

## Implementation Notes

- Prefer placing pure digest/reconciliation helpers in `packages/shared/utils/mcp-config.ts` or a new shared utility if the file grows too broad.
- Filesystem orchestration belongs in `packages/core/src/mcp-library.ts`.
- Desktop IPC belongs in `apps/desktop/src/main/ipc/mcp.ipc.ts`, preload in `apps/desktop/src/preload/api/mcp.ts`, and UI orchestration in `apps/desktop/src/renderer/stores/mcp.store.ts`.
- Avoid adding durable business rules only in React components.
