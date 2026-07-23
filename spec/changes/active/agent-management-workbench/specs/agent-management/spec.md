# Agent Management Workbench Delta Specification

## Added Requirements

### `FR-AGENT-001`: Preset Agents Are First-Class Managed Objects

The system MUST expose every user-enabled built-in Agent platform and every enabled custom Agent platform as first-class managed Agents. It MUST reuse the existing platform registry and MUST NOT require or silently create a duplicate Agent Profile record. Missing deep-management adapters MUST NOT remove an enabled Agent from the workspace.

#### Scenario: Existing preset platform

- Given Claude Code is present and enabled in the built-in platform registry
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

#### Scenario: Agent is disabled in settings

- Given the user disabled a built-in or custom Agent in Agent settings
- When the Agents workspace is opened or refreshed
- Then the disabled Agent does not appear in the workspace list or count
- And enabling it again restores it without changing its platform identity or paths

#### Scenario: Prioritize common Agents

- Given the registry contains common and less common Agent platforms
- When the default Agent list is shown
- Then pinned, installed, configured, and curated common Agents are prioritized
- And every remaining enabled preset Agent stays available through the same list and search

#### Scenario: Default desktop navigation placement

- Given the user has not customized the desktop home module order
- When the desktop navigation is initialized or an older default order is hydrated
- Then `Agents` appears second, immediately after `Prompts` and before `Skills`
- And a genuinely customized complete module order remains unchanged

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

#### Scenario: Current and legacy Kimi Code roots

- Given current Kimi Code uses `KIMI_CODE_HOME` or `~/.kimi-code`
- And legacy kimi-cli may still use `KIMI_SHARE_DIR` or `~/.kimi`
- When PromptHub resolves the Kimi installation
- Then an explicit PromptHub root override remains highest priority
- And a valid current Kimi Code root is preferred over the legacy root
- And the legacy root is used only when the current root is absent
- And configuration, assets, credentials, and sessions from the two roots are never merged implicitly

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

#### Scenario: Open the native Agent application

- Given a desktop Agent declares an allowlisted application path for the current operating system
- When the user chooses Open Agent from its detail header or the Antigravity quota guidance
- Then PromptHub opens or focuses the installed application through the main process
- And the renderer cannot provide an arbitrary executable or filesystem path

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

#### Scenario: Browse current Kimi Code sessions

- Given Kimi Code maintains `session_index.jsonl` and per-session `state.json` and `agents/main/wire.jsonl`
- When the user opens Kimi Sessions
- Then PromptHub reads the bounded index instead of recursively scanning the data root
- And loads state and transcript content only for bounded candidate pages or the selected session
- And provides `kimi --session <id>` as the resume action
- And never edits session files or exposes credential files

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

### `FR-AGENT-020`: Extensible Agent Appearance Management

The shared Agent detail shell MUST expose Appearance as a stable top-level
capability. Appearance support is adapter-defined and MUST NOT create
platform-specific page layouts. Codex appearance management MUST cover native
appearance settings, reversible desktop skins, and locally installed Pets as
independent sub-capabilities within the same page.

Desktop skin packages MUST use the Codex Dream Skin schema: declaration-only
`theme.json` metadata plus one contained local image. Packages MUST be validated
before persistence and applied without modifying the Codex application bundle,
`app.asar`, or code signature. Runtime injection MUST use the pinned audited
Dream Skin runtime, a loopback-only CDP endpoint, verified Codex process
ownership, compatible renderer landmarks, and a verified remove/restore path.
Unsupported Agents keep the Appearance tab visible and disabled.

Codex Pets remain filesystem-owned under the resolved Codex home. PromptHub MAY
list, preview, import, export, delete, and open valid Pet packages, but MUST NOT
duplicate Pet content into SQLite or sync Pet files by default.

Pet previews MUST render one cropped animation cell at a time from the declared
Codex spritesheet. The Appearance page MUST play the standard idle frame loop
instead of scaling the complete atlas into the card. A missing
`spriteVersionNumber` is treated as the Codex v1 8x9 contract; version `2` uses
the 8x11 contract. Reduced-motion mode MUST keep the first idle frame static.

#### Scenario: Apply a compatible Codex desktop skin

- Given a validated theme package declares a Codex target
- And the installed Codex renderer passes the adapter compatibility probe
- When the user applies the theme
- Then PromptHub stages the selected image and `theme.json` atomically
- And starts or connects through a loopback-only CDP endpoint
- And verifies the injected theme before recording a successful apply
- And does not claim the skin remains active after Codex later restarts outside PromptHub
- And the Codex application bundle and signature remain unchanged

#### Scenario: Theme fails compatibility verification

- Given a theme or the installed Codex version does not satisfy required landmarks
- When the user attempts to apply it
- Then the operation fails with a bounded diagnostic
- And managed host settings are restored
- And no active-theme state is reported

#### Scenario: Restore the native Codex appearance

- Given a managed Dream Skin watcher or CDP session is active
- When the user restores the native appearance
- Then PromptHub stops only the identity-verified managed injector
- And removes and verifies the injected CSS and decorative DOM
- And closes the managed debugging session by restarting Codex normally when required
- And preserves the Codex application bundle and unrelated configuration

#### Scenario: Manage local Codex Pets

- Given valid Pet directories exist under the resolved Codex Pet root
- When the Appearance page is opened
- Then each valid Pet is shown with its metadata and a cropped idle animation preview
- And the complete spritesheet atlas is never exposed as the card artwork
- And reduced-motion mode shows one stable idle frame
- And malformed, oversized, escaping, or symlinked packages are rejected
- And deleting a Pet requires confirmation and affects only the selected Pet directory

### `FR-AGENT-021`: Google Coding Surface Lifecycle

PromptHub MUST present Google Antigravity as the current consumer Agent and
MUST NOT present Gemini CLI as a generally available consumer CLI after
2026-06-18. Gemini CLI keeps its existing `gemini` identity and `~/.gemini`
root as an enterprise/paid-API compatibility target so existing users do not
lose access to managed assets. Google Antigravity keeps the `antigravity`
identity and uses
`~/.gemini/config` as the managed customization root for Antigravity CLI and
Antigravity 2.0. Product-owned runtime state under
`~/.gemini/antigravity-cli` and `~/.gemini/antigravity` MUST NOT be treated as
the Skill distribution root.

#### Scenario: Google coding Agents are listed

- Given the user has Gemini CLI and Antigravity CLI or Antigravity 2.0
- When PromptHub builds the Managed Agent registry
- Then `Antigravity` is prioritized as the current entry
- And `Gemini` remains available with an enterprise compatibility label
- And neither built-in display name carries a `CLI` suffix
- And the Gemini detail view directs consumer users to Antigravity while preserving the enterprise and paid API exception
- And Antigravity Skills resolve to `~/.gemini/config/skills`
- And its global MCP, Plugin, and Rules paths resolve to the documented shared customization files
- And PromptHub does not delete or silently migrate the existing `gemini` platform identity

### `FR-AGENT-022`: Overview As Navigation Hub

The Agent Overview tab MUST aggregate live per-domain summaries from the owning domains (Skills, MCP, Rules, Plugins, Sessions, Provider & Model, Appearance, Usage) and each summary MUST navigate to its corresponding workspace tab. The overview MUST NOT create a second copy of owning-domain state, and cells whose capability is planned or unsupported MUST render a disabled state without invoking IPC.

#### Scenario: Navigate from a live summary

- Given Claude Code has 12 detected Skills
- When the user selects the Skills summary cell on the Overview tab
- Then the Skills tab opens
- And the displayed count matches the Skills domain inventory

#### Scenario: Planned capability stays inert

- Given the Usage capability is planned for an Agent
- When the Overview tab renders
- Then the Usage cell shows the planned state
- And no usage IPC call is made

### `FR-AGENT-023`: Claude Code Subscription Quota Adapter

For Claude Code, the system MUST read the platform's own OAuth credential from its native store (macOS Keychain `Claude Code-credentials`, including the hashed-suffix variant, or `<root>/.credentials.json`), query the Anthropic OAuth usage endpoint, and display provider-reported five-hour and seven-day utilization with reset times, labeled as provider-reported. The credential MUST remain inside the main process: never persisted by PromptHub, never sent over IPC, never written to logs or error payloads. Missing, denied, or expired credentials MUST produce explicit guided states; PromptHub MUST NOT attempt token refresh in this phase.

#### Scenario: Quota display

- Given Claude Code holds a valid OAuth credential
- When the Usage tab or overview usage cell loads
- Then five-hour and seven-day utilization and reset times are shown
- And the values are labeled as provider-reported

#### Scenario: Missing credential

- Given no Keychain item and no credentials file exist
- When usage is requested
- Then a guided no-credentials state is returned
- And no network call is attempted

#### Scenario: Expired credential

- Given the credential is expired or the endpoint answers 401
- When usage is requested
- Then an expired state with a re-authentication hint is returned
- And no retry loop or token refresh is attempted

#### Scenario: Secret isolation

- Given any failure in the quota pipeline
- When errors, IPC payloads, or logs are produced
- Then none of them contain the access token or authorization header

### `FR-AGENT-024`: Codex Third-Party Provider Management

For Codex, the system MUST support listing, adding, updating, and removing `model_providers.*` entries and their `profiles.*` in `config.toml` through the verified write pipeline (backup, concurrency digest, atomic write, re-read verification, rollback), without modifying `auth.json`, the built-in `openai` provider, or unrelated config keys. Reserved provider ids (`openai`, `ollama`, `lmstudio`) MUST be rejected. Removing the provider referenced by the active `model_provider` MUST be refused unless the default is switched first. Switching the default `model_provider` MUST use the same verified pipeline and MUST be reversible to `openai`.

#### Scenario: Add a third-party provider without touching the subscription

- Given Codex uses the built-in `openai` provider with a ChatGPT subscription
- When the user adds provider `deepseek` with a base URL, wire API, and API key
- Then `config.toml` gains `model_providers.deepseek` and an optional `profiles.deepseek`
- And `auth.json`, `model_provider`, and all unrelated keys are unchanged

#### Scenario: Managed key custody

- Given a provider is saved with an API key
- When the write completes
- Then the key is stored in the PromptHub secret store (safeStorage-encrypted, 0600, main-process only) and projected into `experimental_bearer_token`
- And no IPC response, log, error, backup manifest, or sync payload contains the key value

#### Scenario: Refuse to remove the active provider

- Given `model_provider` points at `deepseek`
- When the user removes provider `deepseek`
- Then the removal is rejected with guidance to switch the default first
- And `config.toml` is unchanged

#### Scenario: Connectivity test

- Given a saved provider
- When the user runs a test
- Then the main process resolves the credential, validates the URL against SSRF rules, and reports a redacted result (latency, model count, or categorized error)
- And the credential never reaches the renderer

### `FR-AGENT-025`: Desktop-Native Workspace Layout

Every Agent workspace tab MUST render edge-to-edge within the workspace pane: no outer page margin, no centered max-width canvas, and no floating rounded card as the primary surface. Each tab MUST fix a compact toolbar row (title, counts, primary actions) at the top and scroll only inside its content region. List-plus-detail surfaces MUST use a two-pane master-detail layout. Skills, MCP, Rules, and Plugins MUST remain direct top-level tabs without a generic Assets parent, segmented control, or secondary navigation. The Maintenance tab MUST be retired into the workspace header overflow menu. Overview navigation cells MUST navigate directly to the owning domain tab.

#### Scenario: Edge-to-edge tab content

- Given any Agent workspace tab is active
- When the workspace renders
- Then the tab content touches the workspace pane dividers with no outer page margin
- And only the content region scrolls while the toolbar stays fixed

#### Scenario: Direct asset-domain navigation

- Given the user opens Skills, MCP, Rules, or Plugins
- Then the selected top-level tab shows that domain's inventory, path, search or domain-specific actions without a secondary menu
- And unavailable domains remain disabled from the same capability/path source
- And selecting Skills on the Overview navigates directly to the Skills tab

### `FR-AGENT-026`: Codex Subscription Quota And Provider-Aware Overview

For Codex, the system MUST read the platform OAuth credential from `~/.codex/auth.json` and query the ChatGPT backend usage endpoint, displaying provider-reported session (≤24h) and weekly window utilization with reset times and plan type. Windows MUST be classified by `limit_window_seconds`, not slot position. Quota MUST only be queried while the built-in `openai` provider is active; when a third-party provider is active, usage surfaces MUST report the custom-provider state instead, and the Overview Provider & Model cell MUST show the custom provider's sanitized base URL and model. The Overview capability grid MUST be removed and each collapsed path row MUST offer an open-folder action. The credential MUST remain inside the main process under the same isolation rules as `FR-AGENT-023`.

#### Scenario: Official subscription quota

- Given Codex uses the built-in `openai` provider with a Plus subscription
- When the Usage tab loads
- Then session and weekly utilization, reset times, and plan type are shown
- And windows are labeled by their actual durations, not by slot position

#### Scenario: Custom provider active

- Given `model_provider` points at a third-party provider
- When the Overview and Usage tab render
- Then the Provider & Model cell shows the provider's sanitized base URL and model
- And usage surfaces show a custom-provider state without calling the quota endpoint

#### Scenario: Expired credential

- Given `auth.json` is missing or the endpoint answers 401/403
- When usage is requested
- Then a guided no-credentials or expired state is returned without a retry loop

### `FR-AGENT-027`: Codex Product Identity Preference

The built-in `codex` platform MUST use `Codex` as its default user-facing name
without a `CLI` suffix. PromptHub MUST let the user independently choose the
Codex or ChatGPT product name and the Codex or ChatGPT icon from settings while
preserving the stable platform id, paths, capabilities, provider configuration,
sessions, assets, and native integration behavior. The preference is
presentation-only, MUST be validated against the supported choices, and MUST be
included in normal settings persistence, backup, and restore.
The ChatGPT icon choice MUST use the bundled ChatGPT application identity asset
that matches PromptHub's active light or dark theme, rather than a generic
OpenAI provider mark.

#### Scenario: Default identity

- Given no Codex identity preference has been saved
- When the Agent list and detail workspace render
- Then the product name is `Codex`
- And no user-facing Agent label contains `Codex CLI`

#### Scenario: Choose name and icon independently

- Given the user opens Agent settings and edits the built-in Codex configuration
- When they choose the ChatGPT name, retain the Codex icon, and save the Agent configuration
- Then every Agent-workbench Codex identity surface shows `ChatGPT` with the Codex icon
- And the underlying platform id remains `codex`
- And changing the icon later does not rewrite the chosen name

#### Scenario: Identity controls belong to the Codex configuration

- Given the built-in Agent configuration list is not editing Codex
- Then no standalone Codex identity settings section is shown
- When the user edits Codex
- Then the name and icon controls appear with the Codex root and asset-path fields
- And Cancel discards the identity draft
- And Reset restores the Codex name and icon without persisting until Save

#### Scenario: Invalid persisted preference

- Given restored or malformed settings contain an unsupported Codex name or icon value
- When settings are hydrated
- Then PromptHub falls back only the invalid field to its Codex default
- And no arbitrary asset path or remote image URL is rendered

### `FR-AGENT-027`: Polymorphic Multi-Agent Quota

The usage contract MUST describe provider quotas as an ordered list of metrics (`kind: "window" | "quota"`) instead of fixed window fields, and the Overview banner MUST render each metric by semantic shape: ring gauges for reset windows, and progress bars only for credit/balance totals that report numeric used and total amounts. Kimi, Antigravity, Gemini CLI, and Copilot MUST be supported through verified native sessions, credentials, and endpoints (Kimi: coding usages API with weekly + rolling windows; Antigravity: the authenticated desktop language-service session first, then Cloud Code Assist credential fallbacks; Gemini: Cloud Code Assist per-model remaining fractions; Copilot: `copilot_internal/user` premium/chat snapshots). Cursor MUST remain `planned` because no public quota API exists; this is a documented exclusion, not a failure state.

#### Scenario: Kimi dual quota

- Given Kimi Code holds a valid OAuth credential
- When the Overview loads
- Then the banner shows the weekly quota and the rolling five-hour window as separate metrics
- And the membership level is shown as the plan label

#### Scenario: Copilot credit quota

- Given a GitHub OAuth token with Copilot access
- When the Overview loads
- Then premium request usage renders as a progress bar with used/total amounts and the reset date

#### Scenario: Antigravity desktop session quota

- Given Antigravity is running with a signed-in desktop session
- When the Overview loads
- Then PromptHub reads plan and monthly prompt credits from `GetUserStatus`
- And reads the Gemini and third-party model groups' weekly and five-hour pools from `RetrieveUserQuotaSummary`
- And each reset pool renders as its own remaining-quota ring while only monthly prompt credits render as a progress bar
- And no OAuth token or CSRF token leaves the main process or appears in logs, IPC, persistence, or errors

#### Scenario: Antigravity signed in but desktop app is not running

- Given the macOS Keychain contains a renewable Antigravity desktop session
- And the Antigravity desktop process is not running
- When the Overview loads
- Then PromptHub starts only the allowlisted native language-service helper from the installed Antigravity application
- And reads the current quota without opening or keeping the desktop window running
- And stops the temporary helper after success, timeout, malformed output, or request failure
- And no OAuth token or temporary CSRF token leaves the main process or appears in logs, IPC, persistence, or errors
- And only when the installed helper is unavailable or cannot start may the UI offer opening Antigravity as a recovery action

#### Scenario: Polymorphic rendering

- Given an adapter returns both window and quota metrics
- When the banner renders
- Then reset windows render as rings in adapter-defined order
- And only quotas with numeric used and total amounts render as bars

### `FR-AGENT-028`: Skill Asset Cards And Actions In The Agent Workspace

In the Agent workspace Skills tab, skills MUST render as cards with the same badge semantics as the Skills module (In My Skills / symlink install / copy install / unmanaged / built-in) and MUST offer the canonical actions without leaving the workspace: open folder, adopt an unmanaged skill into My Skills, open the managed copy, install library skills into the Agent directory (copy or symlink), and uninstall from the Agent directory with a destructive-confirmation dialog (built-in skills excluded). Selecting a card MUST open the full skill detail page carrying the agent context and its action bar. All state and operations MUST go through the Skills domain's existing stores and services; the workspace MUST NOT duplicate scan results, identity matching, or install logic.

#### Scenario: Adopt an unmanaged skill

- Given the Codex Skills tab shows an unmanaged skill card
- When the user chooses "Import to My Skills"
- Then the skill is imported through the Skills library service
- And the card re-renders with the managed badge after rescan

#### Scenario: Uninstall from the Agent directory

- Given a removable skill card
- When the user confirms uninstall
- Then the platform uninstall handler removes the entry (symlink entries remove only the link)
- And built-in skills never show the destructive action

### `FR-AGENT-029`: Qwen Code Is A First-Class Built-In Agent

PromptHub MUST model Qwen Code as built-in platform `qwen`, separate from
`qoder`, and MUST resolve its user configuration root from `QWEN_HOME` before
falling back to `~/.qwen`. Qwen Code capability support MUST be derived from its
documented user and project asset contracts instead of a generic `skills/`
guess.

#### Scenario: Discover Qwen Code with an overridden home

- Given `QWEN_HOME` resolves to a valid configured directory
- When PromptHub builds the managed-Agent inventory
- Then Qwen Code uses that directory for user settings and user assets
- And project `.qwen/` assets remain project-scoped
- And `QWEN_RUNTIME_DIR` does not replace the user configuration root

#### Scenario: Aggregate canonical Qwen assets

- Given Qwen Code user or project assets exist
- When PromptHub displays the Qwen Code Assets and Config Files surfaces
- Then Skills use complete packages below `skills/<name>/`
- And SubAgents use Markdown definitions below `agents/`
- And MCP projects only the `mcpServers` entries in the relevant `settings.json`
- And Rules distinguish global `~/.qwen/QWEN.md`, project `QWEN.md`, and local `.qwen/QWEN.local.md`
- And Extensions remain parent-owned bundles instead of duplicating their child Skills, SubAgents, MCP servers, or commands into PromptHub ownership

#### Scenario: Preserve Qwen settings and secret boundaries

- Given `settings.json` contains unrelated options or secret-bearing provider, `env`, or MCP fields
- When PromptHub inspects or updates a supported Qwen field
- Then the write plan preserves unrelated JSON fields
- And it creates a backup, replaces atomically, re-reads, verifies, and rolls back on failure
- And renderer payloads, logs, snapshots, exports, and sync results exclude API keys, tokens, headers, MCP environment values, OAuth client secrets, and credential files

#### Scenario: Browse sessions through the native interface

- Given a supported Qwen Code executable and runtime directory
- When the user opens Qwen Code Sessions
- Then PromptHub prefers the bounded native `qwen sessions list --json` interface over recursive filesystem scanning
- And transcript bodies, runtime sidecars, logs, todos, auto-memory, and team memory remain Qwen-owned local state
- And resume/export actions use typed native arguments and explicit user intent

### `FR-AGENT-030`: Verified Read-Only History For Common Agents

The Agent workspace MUST expose read-only local conversation history for every
common Agent whose persisted transcript contract can be verified. The first
breadth batch MUST cover Codex, Claude Code, Gemini, Kimi Code, OpenCode, Grok
Build, OpenClaw, and Qwen Code. Presentation aliases such as `ChatGPT` MUST use
the stable platform id (`codex`) and MUST NOT disable an otherwise available
adapter.

#### Scenario: Browse Codex history under a ChatGPT presentation identity

- Given the user selected the ChatGPT name or icon for platform `codex`
- And Codex has active or archived rollout JSONL files under its resolved root
- When the user opens History
- Then PromptHub lists the newest unique sessions, reads only the selected transcript, and offers `codex resume <id>`
- And developer instructions, reasoning, tool payloads, and malformed records are not rendered as conversation messages

#### Scenario: Browse another verified local format

- Given Grok Build or OpenClaw has a verified local session index and transcript
- When the user opens History
- Then PromptHub returns bounded metadata and a bounded read-only user/assistant transcript
- And paths outside the resolved Agent root, symlink escapes, lock files, caches, and unrelated runtime files are ignored

#### Scenario: An Agent format is not verified

- Given an Agent stores conversations in a proprietary, encrypted, unstable, or undocumented database
- When PromptHub builds its capability projection
- Then History remains disabled with an adapter-unavailable reason
- And PromptHub does not infer support by scanning arbitrary files or displaying raw database records

### `FR-AGENT-032`: Scalable Session Browsing And Explicit Empty State

The Agent workspace MUST page session metadata instead of loading an unbounded
history list, and MUST render long transcripts progressively from an explicitly
bounded read. An installed Agent with zero records in its verified native source
MUST be distinguished from a failed adapter or an unsupported Agent.

#### Scenario: Browse a large history

- Given an Agent has more sessions than the initial page size
- When the user opens History
- Then PromptHub loads only the first metadata page and reports the native total
- And the user can load subsequent pages without re-rendering every off-screen row

#### Scenario: Read a long transcript

- Given the selected transcript contains hundreds of visible entries or exceeds the detail byte cap
- When PromptHub renders the transcript
- Then it initially mounts only a bounded entry batch and allows progressive expansion
- And it clearly reports when the underlying transcript preview was byte-truncated

#### Scenario: Installed Agent has no native sessions

- Given OpenCode is installed but its native `session list` and current database contain zero sessions
- When the user opens History
- Then PromptHub shows an explicit native-source empty state rather than a parse failure
- And it does not fabricate conversations from plugin caches, usage sidecars, or unrelated files

### `FR-AGENT-031`: In-Workspace Agent Editing

The Agent workspace MUST edit the selected Agent in a modal without navigating
to the application Settings page. The modal MUST reuse the existing Agent
settings source of truth and persistence actions rather than introducing a
workspace-only copy of path or identity state.

#### Scenario: Edit a built-in Agent without leaving the workspace

- Given the user opened a built-in Agent detail page
- When the user chooses Edit Agent from the overflow menu
- Then a modal opens with the effective root, asset paths, config paths, and any platform-specific identity controls
- And Save writes through the existing built-in Agent override actions, closes the modal, and keeps the current Agent workspace visible
- And Reset restores the platform defaults in the draft without persisting until Save
- And the header keeps only Agent-level actions rather than duplicating Skills or other asset-domain management

#### Scenario: Edit a custom Agent through the same interaction

- Given the user opened an enabled custom Agent
- When the user chooses Edit Agent
- Then the same modal also exposes its name, enabled state, root, and relative asset paths
- And Save validates and persists through the existing custom Agent action
- And validation failure leaves the modal open and reports the error without partial state

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

- Every enabled Agent in the current built-in registry and every enabled custom Agent is visible without creating a profile; disabled Agents are absent.
- Default ordering prioritizes pinned, installed, configured, and curated common Agents without hiding the remaining enabled Agents.
- Every platform capability is reported independently; unsupported native config management does not block path, asset, or overview management.
- Every adapter that declares provider support passes import, preview, activation, verification, external-change detection, and rollback tests against representative fixtures.
- Agent asset summaries agree with their owning domains.
- At least two verified session adapters support browse/search/read/resume.
- Provider secrets are absent from normal storage, IPC, logs, snapshots, and exports.
- Tray switching uses the same verified activation service.
- Full backup and restore preserve non-secret Agent configuration and expose missing secrets for repair.
- Existing release regression suites remain green.
