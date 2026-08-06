# MCP Behavior Delta

## Requirements

### `FR-MCP-200`: Project targets participate in My MCP

The library detail view, library distribution counts, quick deploy, batch deploy, and related target selection dialogs MUST use the merged visible target set, including project targets. The dedicated Agent and Project workspace tabs MUST remain separately labeled and navigable.

### `FR-MCP-201`: Pi target coverage

The MCP target model MUST include `pi` and the following paths:

| Scope     | Preset            | Path                     |
| --------- | ----------------- | ------------------------ |
| global    | shared MCP        | `~/.config/mcp/mcp.json` |
| global    | agents MCP        | `~/.agents/mcp.json`     |
| global    | agents nested MCP | `~/.agents/mcp/mcp.json` |
| global    | Pi native         | `~/.pi/agent/mcp.json`   |
| workspace | shared MCP        | `<project>/.mcp.json`    |
| workspace | Pi native         | `<project>/.pi/mcp.json` |

The JSON server key for these files MUST be `mcpServers`. PromptHub MUST identify itself as a compatible config writer, not as an embedded `pi-mcp-adapter` runtime. The adapter's documented precedence is low to high: `~/.config/mcp/mcp.json`, `~/.agents/mcp.json`, `~/.agents/mcp/mcp.json`, `<Pi agent dir>/mcp.json`, `.mcp.json`, then `.pi/mcp.json`; PromptHub MUST keep these layers selectable and MUST NOT silently merge or rewrite a lower-precedence source when applying one selected target.

### `FR-MCP-202`: Canonical environment references

The library MUST support additive `envRefs` and `headerRefs` maps. Their values use canonical `${VAR}` or `${VAR:-default}` templates. Legacy values in `env` and `headers` that contain `${VAR}`, `${env:VAR}`, `$VAR`, or `$env:VAR` MUST be normalized to the canonical reference maps.

When materializing a target, PromptHub MUST render references using the target capability table. Current documented mappings are:

| Targets                                                            | Rendered form |
| ------------------------------------------------------------------ | ------------- |
| Cursor, VS Code, Windsurf                                          | `${env:VAR}`  |
| Other supported targets, including Claude, Codex, Pi, and Oh My Pi | `${VAR}`      |

The source library MUST never resolve an environment variable value. A missing variable is reported by health checks without displaying its value. Unsupported or invalid reference syntax MUST remain a non-secret reference or be rejected; it MUST NOT fall back to inserting a resolved secret.

### `FR-MCP-203`: Transport redaction

Generated previews and the `content` field in apply/remove results MUST redact literal environment and header values. MCP library asset snapshots and backup/sync payloads MUST redact literal values. Incoming redaction markers MUST preserve a matching local literal during restore; they MUST NOT overwrite it with the marker.

The UI MUST expose direct-value and environment-reference fields separately. Direct-value fields retain the existing behavior and are visibly treated as local literal values; reference fields contain only variable names/templates.

## Acceptance scenarios

### Scenario: project target is counted in My MCP

Given an MCP server exists only in `<project>/.mcp.json`, when the library detail is opened, then the distributed count is one and the server is included by the distributed filter.

### Scenario: batch deploy includes a project target

Given a selected library server and a registered project, when batch deployment is opened, then the project target is selectable and applying it writes `<project>/.mcp.json` without requiring a custom path.

### Scenario: Pi global and project paths are discoverable

Given a home directory and a registered project, when target presets are derived, then all six Pi presets exist with the documented paths and JSON key.

### Scenario: target-specific reference rendering

Given a header template `Bearer ${TOKEN}`, when a Cursor target preview is generated, then it contains `Bearer ${env:TOKEN}` and no token value; when a Claude or Pi target preview is generated, then it contains `Bearer ${TOKEN}` and no token value.

### Scenario: redacted restore preserves local literal

Given a local literal header and an imported snapshot containing the same server/header with the redaction marker, when the snapshot is restored, then the local literal remains available and the marker is not written to the active library.

## Traceability

| Requirement | Design      | Verification               | Task      |
| ----------- | ----------- | -------------------------- | --------- |
| FR-MCP-200  | DES-MCP-200 | TEST-MCP-200, TEST-MCP-204 | T-MCP-200 |
| FR-MCP-201  | DES-MCP-201 | TEST-MCP-201               | T-MCP-201 |
| FR-MCP-202  | DES-MCP-202 | TEST-MCP-202, TEST-MCP-203 | T-MCP-202 |
| FR-MCP-203  | DES-MCP-203 | TEST-MCP-203, TEST-MCP-204 | T-MCP-203 |
