# Agent Management Workbench Delta Specification

## Added Requirements

### `FR-AGENT-001`: Preset Agents Are First-Class Managed Objects

The system MUST expose every built-in Agent platform and every enabled custom Agent platform as first-class managed Agents. It MUST reuse the existing platform registry and MUST NOT require or silently create a duplicate Agent Profile record. Missing deep-management adapters MUST NOT remove an Agent from the workspace.

#### Scenario: Existing preset platform

- Given Claude Code is present in the built-in platform registry
- When the Agents workspace is opened
- Then Claude Code appears with its detected and configured state
- And the user can manage it without creating a profile

#### Scenario: Configured path does not exist yet

- Given the user configured a custom root for a built-in or custom Agent
- And the directory has not been created
- When the Agents workspace is opened
- Then the Agent remains visible as configured but not detected
- And the missing directory is not interpreted as deletion of the Agent

#### Scenario: Preset Agent has limited support

- Given a built-in Agent has identity and asset paths but no native provider or session adapter
- When the Agents workspace is opened
- Then the Agent remains searchable and its detail page can be opened
- And unsupported capabilities are labeled individually

#### Scenario: Prioritize common Agents

- Given the registry contains common and less common Agent platforms
- When the default Agent list is shown
- Then pinned, installed, configured, and curated common Agents are prioritized
- And every remaining preset Agent stays available through the same list, search, or filters

### `FR-AGENT-002`: Installation And Capability Status

Each managed Agent MUST expose installation detection, executable version where available, resolved roots, config paths, supported capabilities, configuration health, and actionable diagnostics. Detection state and capability support MUST be distinct. Every capability MUST report `supported`, `partial`, `planned`, or `unsupported` independently.

#### Scenario: Adapter is unavailable

- Given an Agent platform is detected
- And no provider adapter exists for that platform
- When its detail page is opened
- Then installation and asset information remains available
- And provider switching is shown as unsupported rather than failed or enabled

#### Scenario: Unified capability controls

- Given two Agents support different management capabilities
- When either Agent detail page is opened
- Then both use the same information architecture and control positions
- And supported capability controls are enabled and actionable
- And unsupported capability controls are visibly disabled with a concise reason
- And the Agent row and detail page themselves remain clickable

### `FR-AGENT-003`: Per-Agent Provider Profiles And Model Mapping

The user MUST be able to create, edit, duplicate, archive, import, export, test, and activate Provider Profiles for supported Agents. A Provider Profile MUST support platform-specific provider protocol, endpoint, model mappings, environment values, and validated non-secret configuration.

#### Scenario: Duplicate display names

- Given two Provider Profiles share a display name
- When either profile is activated, exported, or edited
- Then the system identifies it by stable id
- And never merges profiles by name

#### Scenario: Platform-specific model routes

- Given Claude Code and Codex expose different model keys
- When one logical provider is configured for both Agents
- Then each Agent retains its own explicit model mapping
- And unsupported routes are reported instead of silently discarded

### `FR-AGENT-004`: Import And Backfill Live Configuration

For supported Agents, the system MUST read the current native configuration, normalize known fields, preserve unknown fields, and let the user explicitly import it as a Provider Profile. External changes MUST be detected before switching or reapplying.

#### Scenario: Native config changed outside PromptHub

- Given PromptHub previously activated a Provider Profile
- And the user or Agent changed the native config afterwards
- When the user previews another switch
- Then the system shows the external change
- And offers backfill, preserve, overwrite with confirmation, or cancel

### `FR-AGENT-005`: Safe Provider Activation

Provider activation MUST provide a redacted preview, preserve unrelated configuration, create a backup, write atomically, re-read the target for verification, and restore the previous state after failure. The active state MUST be derived from verified native configuration rather than an independent UI flag.

#### Scenario: Verification fails after write

- Given a valid backup exists
- When the adapter writes the new provider but post-write verification fails
- Then the prior configuration is restored
- And the profile is not reported as active
- And the diagnostic contains no secret value

### `FR-AGENT-006`: Secret Isolation

API keys, tokens, OAuth artifacts, authentication files, and sensitive environment values MUST be represented by secure secret references where PromptHub owns them. They MUST NOT be stored in ordinary Provider Profile JSON, versions, logs, renderer payloads, or default backups.

#### Scenario: Export a Provider Profile

- Given a profile uses an API key
- When the user exports the profile
- Then the export contains a missing-secret requirement or secret reference metadata
- And contains no literal credential

### `FR-AGENT-007`: Universal Provider Projection

The system SHOULD support a logical Provider Profile being projected to multiple compatible Agents through explicit platform mappings. Projection MUST be per-Agent, previewable, and independently reversible.

#### Scenario: One platform is incompatible

- Given a universal provider targets Claude Code, Codex, and Gemini CLI
- And one required protocol is unsupported by Gemini CLI
- When projection is previewed
- Then Claude Code and Codex can proceed independently
- And Gemini CLI is marked unsupported without a false success

### `FR-AGENT-008`: Agent-Centered Asset Aggregation

Each Agent MUST aggregate Skill, MCP, Rules, and Plugin states from their canonical domains. The Agent domain MUST NOT duplicate canonical asset content or create a conflicting assignment source of truth.

#### Scenario: Skill changes in its owning module

- Given a Skill is installed to Claude Code
- When the Skill is updated or removed through the Skill domain
- Then the Claude Code Agent view reflects the new state after refresh
- And no Agent-owned copy remains stale

#### Scenario: Manage from Agent view

- Given an asset is available but not installed to an Agent
- When the user installs it from the Agent view
- Then the owning asset service performs the operation
- And both the Agent view and owning module report the same result

### `FR-AGENT-009`: Native Config File Management

For each Agent with verified native configuration paths, the workspace MUST expose those files in the shared Config Files tab. The user MUST be able to open the Agent root in the system file manager and view or directly edit allowlisted text configuration files through the existing in-app file editor. Agents without a verified config path MUST keep the same tab visible but disabled.

This delivery MUST NOT treat authentication artifacts, session data, logs, caches, databases, or arbitrary files under the Agent root as editable configuration. Direct saves write the platform-owned file without creating PromptHub versions or snapshots. Version history, redacted diff, structured editing, and restore remain follow-up adapter capabilities.

#### Scenario: Agent uses a known config format

- Given Codex CLI resolves to `~/.codex`
- And its verified config path is `config.toml`
- When the user opens Config Files
- Then `config.toml` is available in the shared file editor
- And saving writes only that allowlisted file beneath the resolved Agent root

#### Scenario: Open the native Agent directory

- Given an Agent has a resolved root directory
- When the user chooses Open Agent folder
- Then the operating system file manager opens that root
- And PromptHub does not create a duplicate managed directory

#### Scenario: Platform has no verified config path

- Given a preset Agent is visible but has no verified config-file declaration
- When its detail shell is opened
- Then Config Files remains visible and disabled
- And the UI does not guess a filename or expose the full root as editable config

#### Scenario: Symlink escapes Agent root

- Given an allowlisted config path resolves through a symlink outside approved roots
- When the user attempts to read or write it
- Then the operation is rejected or requires a separately validated user-selected target
- And no external file is modified

### `FR-AGENT-010`: Session Browser And Resume

For platforms with verified session formats, the system MUST support opt-in metadata indexing, search, read-only transcript viewing, project association, and a platform-specific resume command. Source sessions remain platform-owned.

#### Scenario: Source transcript disappears

- Given an indexed session points to an external transcript
- When the source file is removed
- Then the index is marked source-missing
- And PromptHub-owned tags and notes remain
- And no transcript content is fabricated

### `FR-AGENT-011`: Provider Health And Model Test

The system MUST support a redacted provider connectivity test and, where the protocol permits, a real streaming model test that records selected model, result, latency, time to first token, retry count, and structured error category.

#### Scenario: Invalid key

- Given a Provider Profile references an invalid credential
- When a model test is run
- Then the result distinguishes authentication failure from network or model-not-found errors
- And the credential is never included in logs or renderer error details

### `FR-AGENT-012`: Tray Quick Switching

The system SHOULD expose supported Agents, current verified provider state, and a quick provider switch action in the system tray. Tray actions MUST call the same activation service as the Agent workspace.

#### Scenario: Switch from tray

- Given Claude Code has two valid Provider Profiles
- When the user activates one from the tray
- Then the same preview/backup/verify policy is applied
- And the workspace reflects the verified result without a second state store

### `FR-AGENT-013`: Backup, Restore, And Reconciliation

Full backup and Agent-selective export MUST include Provider Profiles, model mappings, non-secret configuration, snapshots metadata, and user preferences. Restore MUST detect the current device, reconcile platform paths and secure secret availability, and preserve unresolved items for repair.

#### Scenario: Restore an old backup

- Given a backup predates Agent management support
- When it is restored by a supporting version
- Then existing data restores normally
- And the Agent provider collection is empty without an import error

### `FR-AGENT-014`: CLI Lifecycle Management

For supported Agents, the system SHOULD provide CLI installation status, installed/latest version, update capability, executable path, package manager/source, and diagnostics. Automatic install or update MUST require explicit confirmation.

#### Scenario: Custom executable path

- Given an Agent CLI is installed outside the app process PATH
- When diagnostics run
- Then adapter-specific path resolution can still locate it
- And the UI reports the resolved source rather than only a boolean

### `FR-AGENT-015`: Usage And Quota Visibility

The system SHOULD support local usage summaries from verified session or request logs and provider quota/balance queries through explicit adapters. Estimates, provider-reported values, and proxy-observed values MUST be labeled separately.

#### Scenario: Partial usage evidence

- Given token counts are available but pricing is unknown
- When usage is displayed
- Then request and token totals are shown
- And cost is marked unavailable rather than guessed

### `FR-AGENT-016`: Safe Deep-Link Import

The system MAY support a versioned `prompthub://` import protocol for Provider Profiles and existing asset domains. Every deep-link import MUST show a decoded, redacted preview and require explicit confirmation before persistence or native config changes.

#### Scenario: Link contains a literal API key

- Given a deep link contains sensitive provider data
- When PromptHub opens it
- Then the UI warns that sensitive data is present
- And the value is masked in previews and logs
- And no Agent config is changed before confirmation

### `FR-AGENT-017`: Proxy And Failover Are Separate Capabilities

Local proxy routing, protocol conversion, failover queues, request logs, and cost accounting MUST be implemented as a separately gated capability rather than a hidden dependency of basic Provider Profile switching.

#### Scenario: Proxy capability is disabled

- Given the product has no proxy module enabled
- When a user activates a direct Provider Profile
- Then native provider switching still works
- And no local listener or traffic interception is started

### `FR-AGENT-018`: Extensible Platform Adapters

The Agent domain MUST expose typed contracts for installation detection, provider config, sessions, CLI lifecycle, quota, and optional proxy integration. A platform without one adapter type MUST still use its supported capabilities.

#### Scenario: Add an OpenCode session adapter

- Given OpenCode already has platform identity and asset distribution support
- When a session adapter is registered
- Then the Agent detail enables Sessions for OpenCode
- And provider, asset, and path behavior does not require modification

### `FR-AGENT-019`: Future Agent Profiles Do Not Replace Platforms

Future Agent Profile or Persona support MAY compose instructions and assets across Agents, but MUST reference existing managed Agents and canonical assets. It MUST NOT replace platform identity or duplicate Agent installation state.

#### Scenario: Add a research persona later

- Given a future persona targets Claude Code and Codex
- When it is deployed
- Then both targets remain the existing managed Agents
- And installation, provider, session, and asset states remain owned by their existing domains

## Non-Functional Requirements

### `NFR-AGENT-001`: Local-First And Privacy

Agent configuration processing and session indexing MUST work locally. External session bodies, credentials, local absolute paths, request logs, and usage details MUST NOT enter remote sync or telemetry by default.

### `NFR-AGENT-002`: Security

All filesystem, IPC, import, deep-link, process execution, and network boundaries MUST validate type, size, path, protocol, command arguments, redirects, timeouts, and redaction. Shell command construction from untrusted strings is prohibited.

### `NFR-AGENT-003`: Reliability

Provider activation and supported config edits MUST be restart-safe, idempotent where possible, backed up, and recoverable after process interruption. No failed operation may be reported as active or synchronized.

### `NFR-AGENT-004`: Performance

The Agents workspace MUST remain responsive with at least 50 platforms, 100 Provider Profiles, 10,000 sessions, and 1,000 assets. Lists and sessions MUST use bounded, cancellable, paginated or virtualized operations.

### `NFR-AGENT-005`: Compatibility

Existing Prompt, Skill, MCP, Rules, Plugin, AI settings, platform paths, backup, sync, tray, and CLI detection behavior MUST remain compatible unless separately specified and tested.

### `NFR-AGENT-006`: Accessibility And Localization

All user-visible copy MUST use the seven supported locales. Keyboard navigation, focus restoration, reduced motion, screen reader names, and narrow desktop layouts MUST be covered.

### `NFR-AGENT-007`: Observability Without Secret Leakage

Operations MUST emit structured result categories, adapter name/version, duration, and redacted diagnostics. Logs MUST never include credentials, authorization headers, full native config files, or unrestricted transcript bodies.

## Acceptance Boundary

The first production delivery is accepted only when:

- Every Agent in the current built-in registry and every enabled custom Agent is visible without creating a profile.
- Default ordering prioritizes pinned, installed, configured, and curated common Agents without hiding the rest.
- Every platform capability is reported independently; unsupported native config management does not block path, asset, or overview management.
- Every adapter that declares provider support passes import, preview, activation, verification, external-change detection, and rollback tests against representative fixtures.
- Agent asset summaries agree with their owning domains.
- At least two verified session adapters support browse/search/read/resume.
- Provider secrets are absent from normal storage, IPC, logs, snapshots, and exports.
- Tray switching uses the same verified activation service.
- Full backup and restore preserve non-secret Agent configuration and expose missing secrets for repair.
- Existing release regression suites remain green.
