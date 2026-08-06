# ISS-20260806-001: MCP Issues 200-202 Triage

## Status

- State: release_pending
- Created: 2026-08-06
- Owner surface: MCP management and Agent platform compatibility
- Related change: `spec/changes/archive/2026/08/2026-08-06-mcp-issues-200-202-implementation/`
- Remote repository: `legeling/PromptHub`

## Scope

This record consolidates the analysis and local delivery state for the three
newest MCP-related issues. The implementation is complete locally; the remote
issues remain open until a release containing the change is published.

## Current issue matrix

| Issue                                                    | Local state       | Current conclusion                                                                                                                                                                                               | Next implementation gate                                                                  |
| -------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [#202](https://github.com/legeling/PromptHub/issues/202) | `release_pending` | Implemented additive direct/reference value kinds, target-specific interpolation, reference-aware health warnings, UI separation, and redaction across renderer/IPC/preview/apply/remove/backup/sync boundaries. | Publish the containing release; a future encrypted-at-rest secret store remains separate. |
| [#201](https://github.com/legeling/PromptHub/issues/201) | `release_pending` | Implemented independent Pi MCP compatibility targets for shared, `.agents`, native Pi, and project files. PromptHub is a config writer, not the `pi-mcp-adapter` runtime.                                        | Publish the containing release; runtime discovery and precedence remain adapter-owned.    |
| [#200](https://github.com/legeling/PromptHub/issues/200) | `release_pending` | Implemented a merged global/project target projection for My MCP detail, counts, quick/batch deployment, and target dialogs without a second storage model.                                                      | Publish the containing release.                                                           |

## Related history

- [#187](https://github.com/legeling/PromptHub/issues/187) is locally
  `local_done` for the currently documented Oh My Pi registry, asset, MCP/Rules
  target, session, and non-secret model projection work. It does not absorb the
  later #200, #201, or #202 requests.
- [#175](https://github.com/legeling/PromptHub/issues/175) is a released
  historical baseline for the first AGHub-style MCP management workbench.
- `pi-agent-separation` deliberately keeps native Pi MCP unsupported until a
  verified native contract exists.

## Findings

### #202: headers and environment references

The implementation keeps literal `env`/`headers` values for compatibility and
stores canonical templates in additive `envRefs`/`headerRefs` maps. It accepts
legacy `${VAR}`, `${env:VAR}`, `$VAR`, and `$env:VAR` forms, renders the target
syntax without resolving the process environment, warns when a required
reference is absent from the current PromptHub process environment, and
redacts direct values at transport boundaries. Restore/update operations
preserve a matching local literal value; explicit `.env` import can convert a
selected reference back to a local literal.

### #201: Pi and `pi-mcp-adapter`

Pi and Oh My Pi retain separate roots, executables, and configuration
lifecycle. The adapter documents six MCP layers and their precedence. PromptHub
now exposes those layers as explicit MCP-manager target presets and writes only
the selected compatible JSON file. It does not install/execute the third-party
adapter or report the writer as a native Pi Agent capability.

### #200: Project MCP from My MCP

Project MCP is not absent. Registered projects already derive workspace target
presets, Project MCP can invoke Add from My MCP, and core bindings support
`scope: "workspace"`.

The library-facing projection now counts and selects both global and registered
project targets. Project application continues to use the existing workspace
binding and target-file source of truth.

## Evidence

- Current implementation: `packages/shared/types/mcp.ts`,
  `packages/shared/utils/mcp-config.ts`, `packages/core/src/mcp-library.ts`,
  `packages/core/src/mcp-target-presets.ts`, and the desktop MCP renderer
  components.
- Stable reference: `spec/knowledge/reference/agent-platforms.md`.
- Active Pi boundary: `spec/changes/active/pi-agent-separation/`.
- Current MCP sync baseline: `spec/changes/archive/2026/07/2026-07-28-mcp-env-sync-reapply/`.
- Pi adapter reference: <https://pi.dev/packages/pi-mcp-adapter>.
- Oh My Pi MCP reference: <https://github.com/can1357/oh-my-pi/blob/main/docs/mcp-config.md>.

## Resolved Decisions

- Pi compatibility is an explicit config-writer target, not a native Pi Agent
  capability and not an embedded `pi-mcp-adapter` runtime.
- Direct local values remain backward-compatible plaintext data. Portable
  references are stored separately, and transport/backup/sync boundaries redact
  direct values while preserving local values on restore.
- My MCP counts include every visible writable global/project preset; the
  actual target file remains the distribution source of truth.

## Snapshot note

The repository-level `github-open.md` snapshot was refreshed from GitHub CLI on
2026-08-06 and contains 34 open issues. This record adds the MCP-specific
interpretation; it does not replace the remote snapshot or local delivery
overlay.
