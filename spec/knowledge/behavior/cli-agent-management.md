# CLI Agent Management

## Stable Boundary

- PromptHub CLI exposes Agent management as the top-level `agent` resource.
- Agent identities come from the canonical built-in/custom platform registry; the CLI does not create a separate Agent Profile catalog.
- Agent-related CLI mutations use the same SQLite `settings` keys as desktop: `builtinAgentOverrides`, `customAgents`, `customAgentRootPaths`, `disabledPlatformIds`, `agentIdentityPreferences`, and the built-in root-path compatibility projection.
- CLI inventory and detail reuse `packages/core/src/agent-management` and the shared capability inventory. Capability states remain `supported`, `partial`, `planned`, or `unsupported` and must not be promoted by presentation code.

## Supported Workflow

- `agent list|get` inspects enabled built-in/custom Agents, detection/configuration status, resolved paths, lifecycle, and capabilities. Disabled Agents are available only through explicit `--include-disabled` queries.
- `agent enable|disable` changes visibility without deleting platform assets.
- `agent add|update|delete` manages custom Agent records. Delete preserves the external root and runtime data.
- `agent configure` manages built-in or custom asset paths; `reset` is built-in-only because custom Agent roots remain required. Custom records may also change paths through `update`.
- `agent config list|read` inspects Agent-native configuration through the shared Core discovery service. Reads are bounded, redact likely secrets, and never modify the source file. Disabled Agents require `--include-disabled`.
- `agent identity get|set` changes the Codex/ChatGPT display preference without changing the stable `codex` platform id.

## Safety And Ownership

- Agent relative asset paths reject absolute paths, traversal segments and NUL before persistence.
- Custom Agent ids must not collide with built-ins or other custom Agents; custom roots are unique case-insensitively.
- A mutation validates the complete next state and writes affected settings in one transaction.
- Registry commands do not edit Agent-native config, secrets, sessions, usage data, appearance state, executables, or package-manager state. Native configuration writes require a portable encrypted-backup boundary before they can be added to the standalone CLI.
- Native configuration reads reject traversal, absolute and excluded paths, symlinked roots/segments, oversized files, and files outside the discovered or declared configuration set.
