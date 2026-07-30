# Source Trust And MCP Market Updates Design

## DES-TRUST-001: Derived Trusted Source Presentation

The stored `trustedSkillUpdateSourceKeys` array remains the authorization source of truth. The settings UI derives presentation records by matching each key against installed Skill `source_id`, `source_url`, `content_url`, or slug identities. A matched record shows `source_label` or a sanitized repository/location plus all matching Skill names. Unmatched legacy records show a bounded abbreviated key. No authorization decision uses the display label.

## DES-MCP-MARKET-001: Main-Process MCP Source Allowlist

- Add a versioned file under `<userData>/data/mcp/market-sources.json` containing normalized custom `McpMarketSource` records.
- Built-in sources remain code-owned and cannot be replaced by custom records.
- Add typed IPC to replace the custom allowlist during renderer-state migration and source mutations.
- Change remote catalog fetch IPC from a bare URL to `{ sourceId, url }`.
- Resolve `sourceId` in the main-process registry, require matching protocol/host/port and an allowed pathname boundary, and then call the existing guarded fetcher.
- Set private-network and insecure-private-HTTP allowances only for a matching persisted custom source. Redirect validation remains inside the remote fetch layer.
- Diagnostics must sanitize credentials, query values, and fragments.

Renderer custom-source persistence remains temporarily as a compatibility mirror. On load, migration is additive and idempotent: renderer-only enabled sources are registered in the main process, while main-only custom sources are restored into the renderer mirror instead of being deleted. Source add/edit/toggle/delete mutations persist to the main process before committing renderer state. The main-process file is authoritative for network authorization.

## DES-MCP-MARKET-002: Template Fingerprint And Three-Way Check

Add optional market provenance to `McpServerSource`: market source id/url, installed template version, installed template fingerprint, last checked time, and last error. Add optional `version` to `McpMarketTemplate`.

The deterministic fingerprint includes source-owned fields that affect runtime or store presentation: template id, version, display name, description, transport, command, ordered args, URL, and sorted env/header key sets. It excludes secret values and PromptHub-owned state.

Reconciliation compares:

- **B**: installed template fingerprint
- **L**: current installed server projected into the same source-owned fingerprint shape
- **R**: current store template fingerprint

Statuses are `up-to-date`, `update-available`, `local-modified`, `conflict`, `legacy-review`, and `source-mismatch`. Updates are allowed by default only for `update-available`; conflict/local-modified/legacy states require explicit force.

Apply preserves the existing server id/name, creation time, enabled/favorite state, notes, tags, cwd override, env values, header values, bindings, and target files. Template env/header keys are merged with current values. Updating the local record naturally makes existing target projection digests stale, so the existing target sync workflow remains the only writer to agent configs.

The official MCP Registry adapter carries registry/server package versions into templates. npm and PyPI package commands pin those versions; OCI identifiers retain their published tag or digest. Unsupported package runtime types are omitted rather than emitted with an incorrect command. The same version/fingerprint contract also applies to future PromptHub Official Store templates.

## Verification Design

- `TEST-TRUST-001`: component tests cover matched readable labels, multiple Skill names, URL sanitization, unmatched legacy fallback, and exact-key revoke.
- `TEST-MCP-MARKET-001`: main/core tests cover persistence, idempotent migration, built-in collision rejection, same-source authorization, path/origin rejection, private-network allowance, and sanitized diagnostics.
- `TEST-MCP-MARKET-002`: pure/core/store/component tests cover install baseline, version/content change, unchanged template, local modification, conflict, legacy handling, secret/user metadata preservation, and target-sync staleness after apply.
