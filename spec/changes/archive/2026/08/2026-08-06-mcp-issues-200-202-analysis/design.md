# MCP Issues 200-202 Analysis Design

<!-- traceability: enforced -->

## Analyze gate

The documentation change has no blocking conflict. It records two existing
design tensions instead of resolving them silently:

1. The active `pi-agent-separation` change intentionally leaves native Pi MCP
   unsupported, while #201 asks about the extension package
   `pi-mcp-adapter`.
2. The archived MCP v1 design intentionally stores user-entered env/header
   values locally, while #202 asks for agent-specific references and safer
   handling.

Those tensions block product implementation choices, but they do not block
accurate issue triage. The implementation of either feature requires a new
issue-specific active change and explicit confirmation of the deferred
decisions in the delta spec.

## Source-of-truth map

| Concern | Current source of truth | Current evidence | Boundary |
| --- | --- | --- | --- |
| Remote issue state | GitHub `legeling/PromptHub` | `gh issue list --state open --limit 1000` on 2026-08-06 | Remote state is not local delivery state |
| Local delivery state | `spec/issues/active/local-github-status.md` | Existing overlay rules | Do not close GitHub issues for local work |
| MCP library records | `data/mcp/library.json` through `packages/core/src/mcp-library.ts` | Archived MCP management and sync changes | Library is normalized source of truth |
| Target projection | Explicit target files and `McpTargetBinding` | `packages/core/src/mcp-library.ts`, target presets | Apply is merge + backup + atomic write |
| Global target registry | `packages/core/src/mcp-target-presets.ts` | `oh-my-pi` is present, `pi` is absent | Pi has no native MCP writer |
| Project target registry | `apps/desktop/src/renderer/services/mcp-target-presets.ts` | Registered project presets include Oh My Pi | Pi `.mcp.json` and `.pi/mcp.json` are not modeled |
| Pi MCP compatibility | Pi package/extension ecosystem | `pi-mcp-adapter` package documentation | Third-party package is not native Pi support |

## `DES-MCP-TRIAGE-001`: Pi identity boundary

Keep `pi` and `oh-my-pi` as independent platform identities. Do not add a
`pi` MCP target merely because Pi can load an extension that reads MCP files.
The current Pi registry has no native MCP relative path, and the active Pi
change explicitly records MCP as extension-provided.

This avoids a false capability claim and keeps the implementation cost bounded:
the current registry scan remains `O(n)` over built-in platforms, while no
additional file scan or runtime process is introduced by this triage.

## `DES-MCP-TRIAGE-002`: Adapter evaluation boundary

Treat `pi-mcp-adapter` as a compatibility candidate owned by the Pi package
ecosystem, not as a PromptHub-native target. A future adapter review must
capture:

- supported config locations and low-to-high precedence;
- whether host config discovery is opt-in or automatic;
- project and user scope behavior;
- variable and command substitution semantics;
- read-only import versus write-back ownership;
- package install and code-execution trust risk.

The default future posture should be bounded, read-only discovery with explicit
provenance. PromptHub should write only to a target contract it can validate
and should never execute an imported MCP server or extension during import.

Oh My Pi is a different case: its documented native MCP files can remain an
explicit PromptHub target, including the existing project target flow.

## `DES-MCP-TRIAGE-003`: Current MCP value boundary

The current normalized `McpServerConfig` has raw string maps for `env` and
`headers`. `packages/shared/utils/mcp-config.ts` recognizes `${VAR}` static
references and serializes the values into target-specific JSON/TOML shapes.
This is a configuration projection, not an environment manager or live auth
check.

The current behavior is compatible with the archived v1 decision, but it is
not sufficient for #202. Documentation, preview, backup, export, sync result,
and logging boundaries must be reviewed together before changing the model.

## `DES-MCP-TRIAGE-004`: Future secret/reference design gate

A future #202 implementation should introduce an explicit value semantics
model rather than expanding the existing string parser in place. At minimum,
the design must define:

| Dimension | Required decision |
| --- | --- |
| Value kind | literal, `${VAR}`, agent-specific reference, command reference, or secret handle |
| Source of truth | local library, environment, keychain, or a documented combination |
| Target capability | which agent can resolve which syntax and at what phase |
| Missing value | preserve, warn, block apply, or omit; behavior must be target-specific |
| Renderer boundary | masked display and redacted preview/result payloads |
| Persistence | encryption/keychain choice, backup/export policy, migration from raw strings |
| Failure recovery | no half-written library or target projection; safe backup and retry behavior |

The future design must include `O(n)` bounded scans for references and a
bounded compatibility matrix. It must not solve secret storage with an
unbounded cache or by copying values into more local files.

## `DES-MCP-TRIAGE-005`: Project MCP distribution boundary

Project MCP already has a real workspace apply path:

- project target presets are derived from registered projects;
- Project MCP can open a target and use Add from My MCP;
- `scope: "workspace"` bindings are supported by the core apply/sync flow.

The issue is therefore not “there is no project MCP support”. The remaining
gap is the library-facing projection: `useMcpLibraryModel` and the detail/batch
dialogs currently use global Agent target presets for distribution and counts,
while Project MCP target actions receive project presets separately.

A future #200 implementation should make scope a shared selector/derived
state for library list, detail, count, batch distribution, and target status.
The registered project inventory remains the source for project roots. A
project-target enumeration is linear in the number of registered projects and
supported presets, `O(P)`, and should remain bounded by the existing project
registry rather than scanning arbitrary directories.

## `DES-MCP-TRIAGE-006`: Issue and release boundary

The local overlay records the issues as open and not locally complete. #187 is
retained as a local completion for its currently documented Oh My Pi work, but
that status does not absorb the new #200, #201, or #202 requests. #175 remains a
released historical baseline for the first MCP management delivery.

The 2026-08-06 open snapshot is a remote fact record. A future release may move
an issue to `release_pending` or `released`, but this documentation change
does not do that.

## Failure and rollback

- If an upstream package changes its config precedence, re-run the adapter
  evidence review before changing the target registry.
- If a future secret migration fails, keep the original library readable and
  do not partially rewrite target files; restore from the existing backup and
  retry through an explicit migration operation.
- If a project target disappears, retain the binding as a missing target state;
  do not delete the library record automatically.
- If the issue snapshot refresh is unavailable, keep the last valid snapshot
  date and record the missing refresh rather than guessing issue state.
