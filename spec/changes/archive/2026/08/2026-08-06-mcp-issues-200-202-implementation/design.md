# Design

<!-- traceability: enforced -->

## Ownership

- `packages/shared/types/mcp.ts` owns the additive contract and target kind.
- `packages/shared/utils/mcp-config.ts` owns reference normalization, target capability/rendering, serialization, and JSON redaction helpers; `packages/shared/utils/mcp-config-redaction.ts` owns format-specific TOML redaction.
- `packages/core/src/mcp-target-presets.ts` owns global Pi paths.
- `apps/desktop/src/renderer/services/mcp-target-presets.ts` owns project Pi paths.
- `packages/core/src/mcp-library.ts` owns library file normalization and generated target content.
- `apps/desktop/src/renderer/components/mcp/*` owns target selection and the direct/reference form fields.
- Backup/sync callers use the shared redaction/restore merge helpers at their existing boundaries.

## `DES-MCP-200`: Merged library target projection

The renderer derives global and registered-project presets once, filters them
through the existing disabled-platform source of truth, and passes the merged
set to My MCP detail, distribution, batch, and dialog surfaces. Agent and
Project workspace routes continue to receive their separate subsets.

## `DES-MCP-201`: Pi compatibility writer

Pi is an MCP-manager target kind with independent presets for each documented
global or project candidate. The generic JSON writer emits top-level
`mcpServers` entries and applies only to the explicitly selected path. The
native Agent capability registry remains unchanged and does not execute or
install the adapter.

## `DES-MCP-202`: Reference normalization and target rendering

The version 1 library gains optional `envRefs` and `headerRefs` maps. Legacy
reference forms are normalized without reading the process environment. The
serializer maps references to the documented target syntax and rejects default
templates for targets that do not support them.

## `DES-MCP-203`: Redacted transport and local restore

Shared redaction helpers mask direct environment/header values while retaining
non-secret references. Main-process apply/remove writers still receive the
local literal and write it atomically; previews, IPC responses, backups, sync
bundles, and asset exports return redacted copies. Restore/update merges a
marker with a matching local value, and environment import explicitly converts
an imported key from a reference to a local literal.

## Analyze Gate

The Pi Agent Separation change requires a boundary clarification: Pi's native
Agent capability remains MCP-unsupported, while this change adds an explicit
MCP-manager compatibility writer. The writer does not execute or install
`pi-mcp-adapter` and is not exposed through the native Agent capability matrix.

| Requirement | Design      | Test                       | Implementation |
| ----------- | ----------- | -------------------------- | -------------- |
| FR-MCP-200  | DES-MCP-200 | TEST-MCP-200, TEST-MCP-204 | T-MCP-200      |
| FR-MCP-201  | DES-MCP-201 | TEST-MCP-201               | T-MCP-201      |
| FR-MCP-202  | DES-MCP-202 | TEST-MCP-202, TEST-MCP-203 | T-MCP-202      |
| FR-MCP-203  | DES-MCP-203 | TEST-MCP-203, TEST-MCP-204 | T-MCP-203      |

No unresolved material decision blocks implementation. The remaining native
Pi capability boundary is recorded in `spec/changes/active/pi-agent-separation/`.

## Data shape

The existing version 1 library shape remains compatible. New optional fields are:

```ts
envRefs?: Record<string, string>;
headerRefs?: Record<string, string>;
```

The maps contain templates, not resolved values. Literal `env` and `headers` values are retained for compatibility. Normalization moves recognized reference templates out of literal maps.

## Rendering

The serializer receives the target kind and resolves only syntax, not values. It combines literal maps with reference maps and renders a reference according to the explicit capability table. The redaction option replaces literal map values while retaining reference templates.

## Transport safety

The active local service continues to need literal values to write a target config when the user explicitly selected direct values. Preview/apply/remove results and outbound asset snapshots use redacted copies. Restore merges a redacted value with the current local library by server identity and key, preserving local direct values. This is intentionally a compatibility layer rather than a new vault.

## Complexity and resource limits

- Target rendering is `O(S + E + H)` per server, where `S` is the number of server fields, `E` environment entries, and `H` headers.
- Project preset derivation is `O(P)` projects with a fixed number of presets per project.
- Snapshot redaction is linear in the number of servers and map entries and does not resolve environment variables or make network calls.
- Existing target writes remain single atomic writes with one optional backup copy; no unbounded fan-out is introduced.

## Failure behavior

- Invalid reference names are rejected during normalization.
- A reference's absence from the process environment is a health warning/error without value disclosure.
- JSON/TOML parse failures retain existing error behavior.
- Redaction/restore operates on copies; an invalid incoming snapshot is rejected by existing library validation before replacement.
