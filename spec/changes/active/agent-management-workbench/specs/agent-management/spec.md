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

#### Scenario: Open a Qwen session from a deep metadata page

- Given `qwen sessions list --json` returns more than 200 bounded metadata rows
- When the user opens a Qwen session that was returned after the first 200 rows
- Then PromptHub reads that selected session without rescanning every transcript
- And retains only a bounded in-memory metadata window
- And revalidates the selected transcript path beneath `QWEN_RUNTIME_DIR` before reading
- And never persists or copies the transcript body

### `FR-AGENT-011`: Provider Health And Model Test

The system MUST support a redacted provider connectivity test and, where the protocol permits, a real streaming model test that records selected model, result, latency, time to first token, retry count, and structured error category.

#### Scenario: Invalid key

- Given a Provider Profile references an invalid credential
- When a model test is run
- Then the result distinguishes authentication failure from network or model-not-found errors
- And the credential is never included in logs or renderer error details

#### Scenario: Activate a paid Gemini API profile

- Given a Gemini Provider Profile owns a `GEMINI_API_KEY` through PromptHub secure storage
- When the user previews and confirms activation
- Then PromptHub updates only the user-level `model.name`, `security.auth.selectedType`, and managed entries in `~/.gemini/.env`
- And preserves unrelated JSON settings, comments, environment entries, and Gemini-owned OAuth or ADC credentials
- And verifies both files before reporting success
- And restores both files if either write or verification step fails

#### Scenario: Preserve enterprise native authentication

- Given Gemini CLI uses Vertex AI, Google OAuth, compute ADC, Cloud Shell, or a Gemini-owned gateway credential
- When PromptHub imports or activates a platform-native Profile
- Then PromptHub records only the non-secret authentication type and model
- And does not read, copy, overwrite, export, or test the external credential
- And directs ordinary consumer users to Antigravity instead of presenting Gemini as the current consumer CLI

#### Scenario: Activate a Kimi Code direct provider

- Given a Kimi Code Provider Profile declares an official provider type, provider id, model alias, upstream model id, context limit, endpoint, and PromptHub-owned API key
- When the user previews and confirms activation
- Then PromptHub updates only the corresponding `providers`, `models`, and `default_model` entries in the resolved `config.toml`
- And preserves unrelated top-level settings, provider/model fields, services, hooks, permissions, and other provider/model entries
- And creates an encrypted backup before the plaintext native credential projection
- And validates, re-reads, and semantically verifies the complete projection before reporting success
- And restores the exact prior file when writing, native validation, or verification fails

#### Scenario: Preserve Kimi Code managed authentication

- Given the selected Kimi provider is owned by `/login`, contains an `oauth` reference, uses Vertex ADC, or contains custom credential headers
- When PromptHub imports or activates the platform-native Profile
- Then PromptHub exposes only redacted provider/model identity
- And never reads, copies, exports, overwrites, or network-tests the platform-owned credential
- And activation may select only an already valid native model entry rather than inventing authentication or provider metadata

#### Scenario: Activate a Qwen Code direct provider model

- Given a Qwen Code Provider Profile declares a provider id, an official protocol, model id, environment key, endpoint, and PromptHub-owned API key
- When the user previews and confirms activation
- Then PromptHub writes the current bare-array `modelProviders[providerId]` shape in user `settings.json`
- And a custom provider id is mapped through `providerProtocol`
- And `security.auth.selectedType` and `model.name` select the same provider model
- And the credential is projected only to the user `.env` file under the declared environment key
- And unrelated settings, provider entries, model entries, environment variables, and unknown fields remain intact
- And apply uses encrypted backup, digest validation, atomic writes, semantic reread verification, and exact rollback
- And connection and explicit model tests reuse the existing main-only protocol probes

#### Scenario: Preserve Qwen Code platform-owned authentication

- Given the selected Qwen provider uses Vertex ADC, legacy Qwen OAuth, Alibaba automatic Coding Plan ownership, or a provider model whose credential source is not owned by the Profile
- When PromptHub imports or previews that native state
- Then only provider, protocol, model, endpoint, environment-key name, and credential-status metadata may cross IPC
- And inline environment values, `.env` values, custom headers, deprecated auth credentials, OAuth state, and ADC material remain hidden
- And PromptHub may select only an already-valid platform-native entry
- And PromptHub does not test or overwrite the platform-owned credential

#### Scenario: Activate an OpenCode custom direct provider

- Given an OpenCode Provider Profile declares a unique provider id, one of the documented OpenAI-compatible runtime packages, an endpoint, primary and optional small model ids, and a PromptHub-owned API key
- When the user previews and confirms activation
- Then PromptHub updates only the selected user `opencode.jsonc`, `opencode.json`, or legacy-precedence `config.json` provider catalog plus `model` and `small_model`
- And stores the API credential only in the native data-root `auth.json` API entry for the same provider id
- And does not write plaintext API keys or authorization headers into the config file
- And preserves unrelated JSONC comments, providers, models, settings, auth entries, and OAuth or well-known credentials
- And applies one digest, encrypted backup, atomic write, semantic reread, and exact two-file rollback boundary

#### Scenario: Preserve OpenCode native authentication

- Given an existing OpenCode provider uses API, OAuth, well-known, environment, file substitution, cloud identity, or an unsupported runtime package not owned by the Profile
- When PromptHub imports or previews the current native state
- Then only the provider/model/endpoint/package and redacted credential-status metadata may cross IPC
- And PromptHub does not read, copy, export, overwrite, or network-test the native credential
- And native activation may select only an already-valid current provider/model state
- And the experimental v2 plural `providers` contract is not written while the stable schema and installed release still use singular `provider`

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

#### Scenario: Confirm and verify an OpenCode CLI update

- Given the installed OpenCode CLI is healthy and its current executable and semantic version are known
- When the user requests an update
- Then PromptHub shows a short-lived review plan containing the fixed official command and detected install source
- And no command runs until the same renderer explicitly confirms that plan
- And apply rechecks the executable and version before running the command without a shell
- And PromptHub verifies the resulting executable after the command
- And a failed verification attempts the official exact-version rollback and verifies the restored executable
- And replayed, expired, foreign-renderer, mutated or stale plans fail without running an update
- And command output, environment values, credentials and raw errors never cross IPC

#### Scenario: Update an npm-managed Codex CLI

- Given the active Codex executable resolves to an npm or Node version-manager installation
- And the matching `npm` executable is available through the main-process command resolver
- When the user reviews and confirms an update
- Then PromptHub runs only the canonical `npm install -g @openai/codex@latest` argument array without a shell
- And it rechecks the active Codex executable and version before mutation
- And it verifies that the same active executable reports a new or unchanged semantic version
- And a partial failure uses the captured prior version with `npm install -g @openai/codex@<version>` and verifies restoration
- And Homebrew, standalone, system, unknown or ambiguous installations remain non-updatable because no exact rollback contract is claimed

#### Scenario: Update an npm-managed Qwen Code CLI

- Given the active Qwen Code executable resolves to an npm or Node version-manager installation
- And the matching `npm` executable is available through the main-process command resolver
- When the user reviews and confirms an update
- Then PromptHub runs only `npm install -g @qwen-code/qwen-code@latest` without a shell
- And it verifies the same active executable after the command
- And any changed or unhealthy post-state triggers exact-version npm recovery
- And standalone, Homebrew, source, system and ambiguous installations remain diagnostic-only

### `FR-AGENT-015`: Usage And Quota Visibility

The system SHOULD support local usage summaries from verified session or request logs and provider quota/balance queries through explicit adapters. Estimates, provider-reported values, and proxy-observed values MUST be labeled separately.

#### Scenario: Partial usage evidence

- Given token counts are available but pricing is unknown
- When usage is displayed
- Then request and token totals are shown
- And cost is marked unavailable rather than guessed

### `FR-AGENT-016`: Safe Deep-Link Import

The system MAY support a versioned `prompthub://` import protocol for Provider
Profiles and existing asset domains. Each supported object type MUST have its
own bounded portable contract. A valid non-secret import MUST show a decoded
preview and require explicit confirmation before persistence or native config
changes. Unsupported object types and sensitive launch arguments MUST fail
closed before reaching the renderer.

#### Scenario: Link contains a literal API key

- Given a deep link contains sensitive provider data
- When PromptHub opens it
- Then the import is rejected with a stable public error
- And the sensitive value is not forwarded, previewed, logged, or persisted
- And no Agent Profile or native config is changed

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

For Codex, the unified Provider Profile database MUST be PromptHub's management
source of truth while `config.toml` remains the Codex runtime projection.
PromptHub MUST support listing, adding, updating, importing and removing
third-party Provider Profiles, then projecting `model_providers.*`,
`profiles.*`, endpoint, protocol, model and credential state through the
verified write pipeline (backup, concurrency digest, atomic write, re-read
verification, rollback), without modifying `auth.json`, the built-in `openai`
provider, or unrelated config keys. Reserved provider ids (`openai`, `ollama`,
`lmstudio`) MUST be rejected. Removing the Provider referenced by the active
`model_provider` MUST be refused unless the default is switched first.
Switching the default `model_provider` MUST use the same verified pipeline and
MUST be reversible to `openai`.

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

#### Scenario: Explicit credential editing

- Given a saved Provider Profile reports only available, missing, or none
- When the user edits its credential
- Then the user explicitly chooses to keep, replace, or remove it
- And replace requires a newly typed value while keep and remove never request
  the stored value
- And visibility can reveal only the unsaved value typed in the current form
- And the renderer never receives the existing credential or its secret
  reference

#### Scenario: Explicitly migrate legacy PromptHub Providers

- Given existing Codex Providers use legacy
  `codex-provider:<providerId>` custody, an environment variable, or a native
  inline token
- When PromptHub discovers them
- Then it shows a redacted migration review and makes no change before the user
  confirms selected Provider ids
- And confirmation creates unified Profile records and
  `agent-provider:<profileId>` credential ownership without rewriting the
  native file
- And legacy secret ownership is removed only after every selected Provider
  has been copied and verified

#### Scenario: Decline or fail legacy migration

- Given a legacy migration review is open
- When the user declines, the preview becomes stale, or any Profile/secret
  operation fails
- Then native config, legacy Profiles and legacy credentials remain usable
- And partial unified Profiles and new secret refs are removed
- And renderer payloads and diagnostics contain no credential value or secret
  reference

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

### `FR-AGENT-035`: Codex Product Identity Preference

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

#### Scenario: Inspect user and project definitions without taking ownership

- Given Qwen Code user or project SubAgents and Commands exist
- When the user opens the Qwen-only Definitions surface and selects a known project
- Then PromptHub resolves the project root from the existing project registry instead of accepting a renderer path
- And it displays bounded, validated metadata for SubAgents and nested Command namespaces
- And definition bodies, absolute paths, credential-like metadata, extension-owned children, and unknown frontmatter do not cross the renderer boundary
- And opening a definition revalidates the relative path, file type, symlink, and containment immediately before the OS action

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

### `FR-AGENT-033`: Oh My Pi Native Agent Boundary

The Agent workspace MUST expose Oh My Pi as the built-in `oh-my-pi` platform
without a `CLI` suffix. Its default user root MUST be `~/.omp/agent` and the
`PI_CODING_AGENT_DIR` environment variable MUST override that root when it is
an absolute path. PromptHub MUST derive Oh My Pi Skills, Rules, MCP, Plugin and
allowlisted config paths from that root and MUST preserve project MCP at
`.omp/mcp.json` as a separate workspace target.

When the Oh My Pi session contract is available, the workspace MUST provide a
bounded, read-only JSONL history adapter under `<root>/sessions/`. It MUST
ignore nested subagent transcripts and symlink escapes, cap metadata and
transcript reads, isolate malformed rows, and expose `omp --resume <id>` rather
than executing a command or writing platform state. Provider switching, usage,
credential management and plugin package installation MUST remain independently
planned until their native contracts have dedicated adapters and tests.

#### Scenario: Manage Oh My Pi assets

- Given Oh My Pi is enabled in the built-in registry
- When the Agent workspace resolves its root
- Then it shows the native root, `skills/`, `RULES.md`, `mcp.json`, sibling
  `../plugins`, and the allowlisted config files
- And the user can target the global MCP file or project `.omp/mcp.json`
- And the UI does not invent provider, usage, or plugin-install support

#### Scenario: Browse Oh My Pi history safely

- Given `<root>/sessions/` contains direct project JSONL files with valid
  session headers
- When the user opens Oh My Pi History
- Then PromptHub returns bounded metadata and visible user/assistant/tool rows
  on demand, with malformed rows counted but not rendered
- And nested subagent files, symlinks, unsafe ids, and transcript writes are
  excluded
- And the selected session exposes `omp --resume <id>` metadata only

### `FR-AGENT-034`: Oh My Pi Non-Secret Model Projection

The Agent workspace MUST inspect the Oh My Pi global `config.yml` (or the
documented `config.yaml` fallback) and the optional `models.yml` under the
resolved agent root. It MUST expose only the selected `modelRoles.default`,
provider/model selectors declared in `models.yml`, sanitized provider endpoint,
and credential readiness. API keys, headers, OAuth records, and arbitrary model
metadata MUST NOT cross the main/renderer boundary.

When the user changes the Oh My Pi default model, PromptHub MUST update only
`modelRoles.default` through the existing backup, atomic-write, re-read and
rollback pipeline. It MUST preserve unrelated YAML values and comments as far
as the parser allows, refuse malformed or oversized input, and leave native
provider authentication and usage ownership to Oh My Pi.

#### Scenario: Inspect Oh My Pi model routing without exposing secrets

- Given `models.yml` declares providers and model ids and `config.yml` selects
  `modelRoles.default`
- When the Agent workspace opens Provider & Model
- Then it shows the selected provider/model, available provider/model selectors,
  and a sanitized endpoint when present
- And `apiKey`, headers, OAuth data, and unrelated provider fields are absent
  from the returned model configuration

#### Scenario: Update and verify the Oh My Pi default model

- Given a valid Oh My Pi `config.yml`
- When the user saves a new model selector
- Then only `modelRoles.default` changes, a local backup is created, the file is
  atomically replaced and re-read, and the verified model configuration is
  returned
- And a parse, concurrent-change, or verification failure restores the exact
  previous file and returns an update error

### `FR-AGENT-036`: GitHub Copilot CLI Native Boundary

PromptHub MUST resolve the current Copilot CLI root from `COPILOT_HOME` or
`~/.copilot` and MUST use only GitHub's documented user-editable paths for
Skills, MCP, personal instructions, custom agents, settings, and installed
Plugin discovery. Automatically managed `config.json`, native authentication,
session state, permission decisions, OAuth fallback stores, and Plugin metadata
MUST remain Copilot-owned.

The Provider & Model surface MAY inspect and update only the documented
top-level `model` in `settings.json` through the shared backup, atomic-write,
re-read, and rollback pipeline. Copilot BYOK Provider configuration is
environment-only; PromptHub MUST NOT claim endpoint or credential activation
without a separately approved launch/runtime environment design.

#### Scenario: Change only the Copilot CLI model preference

- Given a valid JSONC `settings.json` with unrelated user settings and comments
- When the user activates a platform-native Profile with a different model
- Then PromptHub changes only the top-level `model`, preserves the other
  settings and comments, and verifies the re-read value
- And endpoint/secret Profiles remain blocked because no durable native
  Provider projection contract exists

### `FR-AGENT-037`: Copilot Plugin Installation Must Be Native

PromptHub MAY discover valid Copilot packages under documented installed
locations, but MUST NOT treat direct filesystem projection into
`installed-plugins/` as an installation. Until PromptHub has a bounded native
`copilot plugin install` adapter with preview, confirmation, verification, and
rollback, the Copilot Plugin distribution target MUST remain visible but
disabled with an explicit reason.

#### Scenario: Reject an unregistered Copilot Plugin distribution

- Given a valid PromptHub Plugin bundle and a Copilot installation
- When the user inspects Agent Plugin targets
- Then GitHub Copilot is visible as an adapter target but disabled
- And a direct distribution request fails before resolving or writing a target
  path
- And already installed Copilot packages remain available to read-only
  discovery

### `FR-AGENT-038`: Cursor Current Asset And Native Plugin Truth Boundary

PromptHub MUST resolve Cursor from `~/.cursor` and expose only evidence-backed
user-owned asset paths: `skills/`, `agents/`, `mcp.json`, and read-only Plugin
discovery below `plugins/`. It MUST NOT invent a global rule file or generic
config path for settings-owned user rules, and MUST NOT expose private
authentication, transcript, checkpoint, snapshot, cache, log, or Electron /
VS Code database state.

PromptHub MAY discover valid Cursor packages from Marketplace cache and local
Plugin roots, but MUST NOT treat generated package output or a copied directory
as an installed or loaded Plugin. Until a native Marketplace or local-plugin
adapter provides preview, confirmation, activation verification, and rollback,
the Cursor distribution target MUST remain visible but disabled.

#### Scenario: Project verified Cursor assets without private runtime state

- Given the built-in Cursor Agent is listed
- When PromptHub projects its paths and capabilities
- Then Skills, SubAgents, MCP, and the Plugin root derive from `~/.cursor`
- And no global rule file or generic config file is claimed
- And Provider, Sessions, Usage, and Maintenance remain planned

#### Scenario: Reject an unverified Cursor Plugin distribution

- Given a valid PromptHub Plugin bundle and a Cursor installation
- When the user inspects Agent Plugin targets
- Then Cursor is visible as an adapter target but disabled
- And a direct distribution request fails before target resolution or writes
- And installed Marketplace-cache and local packages remain read-only

### `FR-AGENT-039`: Cherry Studio Current Data And Skill Boundary

PromptHub MUST project the Cherry Studio default user-data root and
`Data/Skills` path without treating its SQLite, IndexedDB, Local Storage,
memory, credential, cache, or runtime files as generic Agent assets. For the
existing database-backed Skill adapter, `Data/cherrystudio.sqlite` MUST take
precedence over compatible `Data/agent.db`, `Data/agents.db`, and root-level
legacy databases.

Cherry Studio Provider, MCP, Sessions, Usage, Config Files, Rules, and
Maintenance MUST remain planned until separately verified adapters exist. The
composite Plugin target MUST remain disabled because current Cherry Studio
Skills do not establish a general Plugin bundle contract.

#### Scenario: Prefer the current Cherry Studio v2 database

- Given `Data/cherrystudio.sqlite` and a compatible legacy database both exist
- When PromptHub installs or reconciles a Cherry Studio Skill
- Then it updates only the current v2 Skill registry
- And the legacy registry remains unchanged
- And the complete Skill package remains under `Data/Skills`

#### Scenario: Project only evidence-backed Agent capabilities

- Given the built-in Cherry Studio Agent is listed on macOS
- When PromptHub builds its paths and capabilities
- Then the default root, `Data/Skills`, and installed application launch path
  are available
- And no MCP, Rules, Plugin directory, Config, Provider, Session, Usage, or
  Maintenance support is claimed

### `FR-AGENT-040`: Windsurf Public Transcript History

PromptHub MUST read only explicit Cascade transcript exports from
`~/.windsurf/transcripts/*.jsonl`. It MUST NOT parse proprietary Cascade
protobuf/runtime state below `~/.codeium/windsurf/cascade`, memories, code
tracker data, databases, credentials, or caches.

The adapter MUST be local-only, read-only, paginated, size bounded, symlink
safe, and resilient to malformed or future JSONL step types. It MUST expose
only visible user input and planner response text; code actions, file content,
command output, tool arguments, and other tool payloads MUST remain hidden.
Because the public transcript contract provides no native resume command,
session metadata MUST use `resume: null` and the capability MUST be `partial`.

#### Scenario: Browse an opt-in Windsurf transcript

- Given Cascade Hooks wrote a valid transcript JSONL with `user_input`,
  `planner_response`, and tool/code steps
- When PromptHub lists and reads Windsurf history
- Then the trajectory id, first user prompt, update time, source path, and
  visible user/assistant messages are available
- And tool/code payloads are absent
- And no resume command is offered

#### Scenario: Reject unsafe or unbounded transcript input

- Given a symlinked transcript, path traversal id, oversized file, malformed
  JSONL line, or unknown step type
- When PromptHub scans or reads Windsurf history
- Then symlinks and traversal are rejected
- And reads remain within the file, entry, page, and scan limits
- And malformed lines are counted without exposing hidden payloads
- And no source file is modified

#### Scenario: Preserve Windsurf capability boundaries

- Given the built-in Windsurf Agent
- When PromptHub projects its current capabilities
- Then Skills, MCP, global Rules, launch, and partial transcript history use
  their documented paths
- And Provider, Usage, generic Config Files, Maintenance, and native Plugin
  installation remain unavailable until separately verified

### `FR-AGENT-041`: Kiro Current CLI Boundary

PromptHub MUST use Kiro's documented `KIRO_HOME` / `~/.kiro` root and MUST
limit model mutation to `settings/cli.json` field `chat.defaultModel`.
Credentials, account state, endpoints, and provider selection remain
platform-managed and MUST NOT enter renderer payloads, ordinary backup, or
PromptHub-owned secret storage.

Kiro's global `steering/` directory MUST NOT be exposed as a single editable
Rules file. It remains unavailable until the Rules owner supports bounded
multi-file directories with explicit selection and write semantics.

PromptHub MAY expose locally verified Kiro CLI session files as a partial,
read-only capability. It MUST expose only visible prompt and assistant text,
hide thinking/tool/result/unknown payloads, enforce bounded and symlink-safe
reads, and set `resume: null` because no documented per-session resume
contract has been verified.

PromptHub MUST NOT claim that direct filesystem copying installs a Kiro Power.
Kiro Plugin distribution remains disabled until an official import or
registration workflow can be previewed, explicitly confirmed, verified, and
rolled back.

#### Scenario: Inspect and change the Kiro default model

- Given a valid Kiro `settings/cli.json` with comments or unrelated fields
- When PromptHub inspects or changes the default model
- Then only `chat.defaultModel` is projected or changed
- And comments and unrelated fields are preserved
- And backup, atomic replacement, digest race detection, reread verification,
  and rollback protect the write
- And no credential, endpoint, account, or provider value is exposed

#### Scenario: Browse visible Kiro CLI session content

- Given matching Kiro CLI metadata and JSONL files
- When PromptHub lists and reads a session
- Then metadata and visible Prompt/Assistant text are available
- And ToolResults, thinking, tool-use, malformed, and unknown payloads are not
  exposed
- And pagination, entry/file/scan limits, safe ids, root containment, and
  symlink rejection remain enforced
- And the session has no synthetic resume command

#### Scenario: Reject fake Kiro Power installation

- Given a valid PromptHub Plugin package and the Kiro target
- When direct distribution is requested
- Then the operation fails before resolving a package or writing files
- And the UI explains that native Kiro import/registration is required
- And existing Power package structures may remain available for bounded,
  read-only inventory without being reported as PromptHub-installed

### `FR-AGENT-042`: Grok Build Provider And Model Boundary

PromptHub MUST resolve Grok Build from `GROK_HOME` or `~/.grok` and MAY manage
the documented user `config.toml` Provider and default-model projection.
Provider Profiles MUST use Grok's public `[model.<alias>]` and
`[models].default` contract and MUST preserve unrelated TOML data.

PromptHub MUST NOT copy or vendor Grok Build or CC Switch source. It MAY reuse
their documented protocol shapes and workflow concepts through an independent
PromptHub adapter.

Grok-native session/OIDC credentials and `XAI_API_KEY` remain
platform/environment owned. Custom Providers MAY reference an environment
variable through `env_key`, but PromptHub MUST NOT project a managed secret,
inline `api_key`, sensitive header, session token, or auth file into
`config.toml`. Native entries containing inline credentials or sensitive
headers MUST be redacted and read-only. Connection and model tests MAY resolve
an `env_key` only inside the main process.

#### Scenario: Activate an environment-owned custom Provider

- Given a valid Grok Provider Profile with alias, protocol, upstream model,
  endpoint, context window, and environment-key name
- When the user previews and confirms activation
- Then PromptHub updates only `[model.<alias>]` and `[models].default`
- And creates an encrypted backup before an atomic write
- And detects concurrent changes, rereads the file, verifies the intended
  projection, and restores the backup on failure
- And no credential value crosses IPC or enters ordinary backup/export

#### Scenario: Keep Grok-owned authentication read-only

- Given the active Grok model uses the native session, `XAI_API_KEY`, an
  inline `api_key`, or sensitive custom headers
- When PromptHub inspects or imports the current Provider
- Then only redacted Provider, protocol, endpoint, model, context, environment
  key name, and credential readiness metadata may cross IPC
- And PromptHub does not copy, export, overwrite, or persist the credential
- And an inline-secret or sensitive-header Provider cannot be taken over by a
  mutable PromptHub Profile

#### Scenario: Reject unsafe Grok configuration input

- Given a malformed, oversized, symlinked, out-of-root, duplicate, or
  concurrently modified Grok configuration
- When PromptHub inspects, imports, previews, applies, verifies, or rolls back
- Then the operation fails with a stable redacted error
- And no partial Provider state or plaintext backup remains

### `FR-AGENT-043`: Amp Current Public Asset And MCP Boundary

PromptHub MUST model Amp from the current public Owner's Manual rather than the
previous evidence-limited placeholder. The user root is `~/.config/amp` on
macOS/Linux and `%USERPROFILE%\.config\amp` on Windows. PromptHub MAY retain
the former Windows `%APPDATA%\amp` path as a read-only compatibility fallback.

Amp Skills, `AGENTS.md`, Plugins and MCP settings MUST continue through their
existing owning domains. Global MCP lives in `settings.json` or
`settings.jsonc` below the user root; project MCP lives in the nearest
`.amp/settings.json` or `.amp/settings.jsonc`; server entries use the literal
top-level key `amp.mcpServers`. PromptHub MUST preserve all unrelated dotted
settings and MUST NOT flatten this key into a nested `amp` object.

Amp's hosted account, models, threads, OAuth cache and workspace-managed global
Plugins remain platform-owned. PromptHub MUST NOT claim a Provider adapter,
local transcript adapter, usage adapter, native Plugin installer, or writable
raw-config surface without a separate verified contract.

#### Scenario: Synchronize global and project Amp MCP settings

- Given a user or project Amp settings file with unrelated dotted settings
- When the user previews and confirms an MCP synchronization through the MCP
  owning domain
- Then PromptHub reads and writes only the literal `amp.mcpServers` entry map
- And preserves unrelated JSON/JSONC settings
- And uses the canonical user or project settings path for the selected scope

#### Scenario: Keep unsupported Amp depth capabilities explicit

- Given Amp is enabled in Agent Management
- When PromptHub builds its capability inventory
- Then Skills, MCP and Rules reflect their documented path-level support
- And Provider is unsupported because Amp does not expose a user-managed
  provider projection
- And Sessions, Usage, Config Files, Launch, Maintenance and Plugin
  distribution remain planned until dedicated adapters satisfy their gates

### `FR-AGENT-044`: Provider Credential Replacement Compensation

PromptHub MUST treat Provider Profile metadata, model mappings and the
main-process secret store as one recoverable credential-management operation.
When replacing a legacy or current secret reference, a failure after the
database points at the new reference MUST restore the prior database record,
model mappings and secret state before reporting failure.

The operation MUST distinguish an ordinary rejected update from a failed
compensation. It MUST NOT clear the new secret while the database still points
at it, and it MUST NOT leave the database pointing at a cleared or missing
secret reference. Renderer results, logs and stable errors MUST remain
secret-free.

#### Scenario: Legacy secret cleanup fails after database update

- Given a Provider Profile references a legacy secret and both prior metadata
  and model mappings are readable
- And the replacement secret is written and the database update succeeds
- When deleting the legacy secret fails
- Then PromptHub restores the prior profile and model mappings using the
  updated optimistic timestamp
- And restores the exact prior secret state only after the database rollback
- And reports `AGENT_PROVIDER_PROFILE_UPDATE_FAILED` when compensation
  succeeds

#### Scenario: Database compensation fails

- Given the database already points at the replacement secret
- When legacy secret cleanup and database compensation both fail
- Then PromptHub preserves the replacement secret required by the current
  database record
- And reports `AGENT_PROVIDER_PROFILE_UPDATE_ROLLBACK_FAILED`
- And no credential value appears in the error

### `FR-AGENT-045`: Provider Endpoint Credential Exclusion

Provider Profile endpoints are public metadata and MUST NOT contain embedded
credentials. PromptHub MUST accept only bounded HTTP(S) endpoints without URL
userinfo or fragments, and MUST reject malformed URLs, unsupported schemes,
control characters and oversized values before persistence or IPC projection.

The same validation MUST protect renderer submission, SQLite create/update and
SQLite reads. Stable errors MUST NOT echo the rejected endpoint. Existing
unsafe rows MUST fail closed when read; this change MUST NOT silently rewrite
legacy data without a separately reviewed migration and recovery plan.

#### Scenario: A user pastes a credential-bearing endpoint

- Given the Provider form contains all other required fields
- When the endpoint contains a username or password component
- Then the form shows a localized validation error
- And no Profile create/update request is sent
- And a direct storage call rejects the endpoint before SQLite changes

#### Scenario: A legacy row contains endpoint credentials

- Given a pre-existing SQLite row contains URL userinfo
- When PromptHub loads the Provider Profile
- Then the public projection fails with `AGENT_PROVIDER_ENDPOINT_INVALID`
- And the stable error does not include the credential
- And PromptHub does not silently mutate the row

### `FR-AGENT-046`: Provider Public JSON Credential Exclusion

Provider Profile config, model mappings, audit snapshots and recovered
activation baselines MUST contain only bounded public JSON metadata. The
storage boundary MUST reject sensitive key families and non-JSON values before
write, MUST validate the same records again on read, and MUST use the same
policy for baseline recovery.

Errors MUST be stable and MUST NOT contain a rejected value. Existing unsafe
rows MUST fail closed without silent mutation or automatic credential
migration. A rejected create or update MUST leave the database unchanged.

#### Scenario: An adapter tries to persist a credential in an audit snapshot

- Given an activation result contains an API token, private key or
  authorization header in `redactedSnapshot`
- When the audit repository records the result
- Then SQLite rejects the snapshot before insertion
- And no credential value appears in the error
- And the activation workflow reports an audit-write failure rather than
  treating the unsafe snapshot as verified

#### Scenario: An older database contains unsafe public JSON

- Given a Profile config, model mapping or verified snapshot contains a
  credential-bearing key
- When PromptHub projects that row or restores the baseline
- Then it fails with a stable public-config or baseline error
- And it neither returns the record nor mutates the stored value

### `FR-AGENT-047`: Session Index Cancellation And Scale Boundary

A persistent session-index refresh MUST treat cancellation as a commit
barrier. If cancellation is already requested, or arrives after the adapter
finishes scanning but before SQLite commit, PromptHub MUST write no session
rows, cursor, scan timestamp or failure state. Cancellation reasons from
renderer or platform code MUST NOT become stored or user-visible diagnostics.

The metadata index MUST accept the documented 10,000-session hard limit in one
transaction and expose it only through bounded pages of at most 200 records.
The persisted schema and ordinary backup/export flow MUST exclude transcript
bodies; details continue to be read from the external source on demand.

#### Scenario: Cancellation races with scan completion

- Given an enabled source has finished producing a valid scan result
- When its abort signal becomes cancelled before commit
- Then refresh rejects with the stable `AGENT_SESSION_SCAN_CANCELLED` error
- And the source cursor, status and indexed rows remain unchanged
- And no scan failure is recorded

#### Scenario: A source contains 10,000 sessions

- Given a verified adapter produces exactly 10,000 bounded metadata records
- When PromptHub commits and lists the index
- Then all records are committed atomically and reachable through 200-row
  pages
- And search remains literal and Unicode-safe
- And no transcript body column or ordinary backup payload is introduced

### `FR-AGENT-051`: Agent-Scoped Rule Editing

When an Agent exposes one resolved global rule-file path, its `Rules` tab MUST
open that exact file in the existing Rules workspace editor rather than a
read-only generic asset list. The Agent surface and the standalone Rules
surface MUST share the same descriptor, draft, save, conflict and version
state; the Agent tab MUST NOT introduce a second rule store or a second file
write path.

Selection MUST prefer the normalized resolved file path over platform identity
so root overrides, shared platform roots and custom Agents select the intended
file. Entering or switching the Agent MUST NOT briefly expose another Agent's
rule content. A missing cached descriptor MAY trigger one bounded rescan, after
which the UI MUST show a scoped retry or unavailable state rather than scanning
indefinitely.

Directory-based, project-scoped and multi-file rule systems remain outside this
single global-file editor unless they are separately registered in the Rules
workspace.

#### Scenario: An Agent rule is edited from the Agent workspace

- Given Claude Code resolves to one tracked `CLAUDE.md` descriptor
- When the user opens its `Rules` tab, changes the draft and saves
- Then the existing Rules workspace save operation writes that descriptor
- And the same draft, snapshot and conflict state is visible from the
  standalone Rules module
- And no Agent-specific persistence record is created

#### Scenario: The selected Agent changes while another rule is loaded

- Given the Rules store currently contains a different Agent's file
- When the user selects an Agent with another resolved global rule path
- Then the previous file content is not rendered in the new Agent tab
- And the matching descriptor is loaded by path before its editor is shown
- And at most one forced rescan is attempted if the descriptor was not cached

### `FR-AGENT-052`: Compact Rule Editing Actions

The shared Rules editor MUST keep the editable draft as its primary workspace.
AI rewriting and version history MUST open from compact header actions in
focused dialogs rather than occupying a permanent auxiliary column. The editor
MUST use the established card/background tokens instead of broad muted-gray
panels, and the same interaction MUST be available from both the standalone
Rules module and the Agent Rules tab.

#### Scenario: The user requests an AI rewrite

- Given a rule draft is open
- When the user selects `Improve with AI`
- Then a focused dialog collects the rewrite instruction
- And a successful rewrite closes the dialog and updates only the draft
- And a failed rewrite leaves the dialog open with an error
- And no source file is written until the existing save action is confirmed

#### Scenario: The user reviews version history

- Given a rule file has zero or more snapshots
- When the user selects `Version Snapshots`
- Then a dialog shows the empty state or the bounded snapshot list
- And selecting a snapshot keeps the dialog open and shows its line-level
  comparison with the current draft inside the same dialog
- And the user can switch snapshots without losing the current draft
- And restore/delete continue through the existing Rules store workflows

### `FR-AGENT-053`: Compact Agent Detail Header

The Agent detail header MUST derive its height from the visible identity,
actions and tab strip. It MUST NOT reserve a fixed empty band between the
identity row and the tabs. Header actions MAY wrap at narrow desktop widths
without overlapping the identity or making tabs inaccessible.

#### Scenario: A standard Agent detail opens

- Given the selected Agent has no lifecycle guidance below its identity
- When the detail workspace renders
- Then the identity and actions occupy only their natural content height
- And the tab strip follows immediately without a fixed-height spacer
- And all existing header actions and tabs remain available

### `FR-AGENT-054`: Edge-To-Edge Rule Editing Canvas

The shared Rules editor MUST use the available workspace below its file toolbar
without nesting the draft or snapshot diff inside a floating card with
decorative outer margins, rounded corners or a shadow. The draft status row
MUST remain visually separated from editable content.

#### Scenario: A rule draft is open

- Given a rule file has been loaded in the standalone or Agent Rules workspace
- When the editable draft is shown
- Then its status row and content fill the remaining workspace
- And no decorative inset exposes unused edges around the editor
- And editing, focus, scrolling, AI rewrite and version preview behavior remain
  unchanged

### `FR-AGENT-055`: Markdown-Aware Rule Editing

The shared Rules editor MUST provide a Markdown-aware editing surface rather
than a plain textarea. It MUST preserve the current draft as the only editable
state while adding syntax highlighting, line numbers, undo/redo, search,
bracket handling, indentation and Markdown list/quote continuation. Parent
draft refreshes MUST NOT create a second user edit or corrupt the undo history.
The same surface MUST offer Edit, Preview and Split modes without changing the
draft owner. Preview navigation MUST stay inside the application, Split mode
MUST keep source and rendered content aligned by Markdown source position, and
long previews MUST provide a reduced-motion-aware return-to-top action. The
compact mode selector MUST sit at the toolbar's far right after the line and
character counts, use familiar editor, book and split-layout
icons, and MUST NOT use an eye icon for document preview.

#### Scenario: Continue a Markdown list

- Given a rule draft contains a Markdown list item
- When the user presses Enter at the end of that item
- Then the editor continues the appropriate Markdown marker
- And the Rules store receives the resulting draft once
- And the source file remains unchanged until Save is selected

#### Scenario: Review a long rule without leaving the application

- Given a long Markdown rule is open with an unsaved draft
- When the user switches between Edit, Preview and Split
- Then the same draft is rendered without persistence or a second draft state
- And scrolling either Split pane aligns the other pane by source section
- And an internal table-of-contents link scrolls the preview instead of opening
  a browser
- And the preview offers a return-to-top action after meaningful scrolling

### `FR-AGENT-056`: Explicit AI Rewrite Model Selection

The AI rewrite dialog MUST let the user select a configured provider and one of
that provider's chat models before generating a draft. The current default chat
model SHOULD be selected initially. Image-only models MUST NOT be offered.
Legacy single-model settings MAY appear as one compatible fallback choice.
Changing this selection MUST affect only the current rewrite request and MUST
NOT mutate global model defaults.

#### Scenario: Rewrite with a non-default configured model

- Given two configured providers each expose a chat model
- When the user selects the second provider and model and starts a rewrite
- Then the existing Rules rewrite request uses exactly that model's endpoint,
  protocol and credential configuration
- And no provider or model default is changed
- And a missing credential or unavailable model keeps the dialog open with an
  actionable error

### `FR-AGENT-057`: In-Dialog Rule Version Comparison

Version history MUST use one focused dialog that combines the bounded snapshot
list and the existing line-level diff presentation. Selecting a snapshot MUST
not replace the editor canvas or add temporary actions to the file header.
Opening the dialog MUST immediately select the newest non-current snapshot
when one exists, otherwise the current snapshot, so comparison never opens as
an unexplained blank panel.
Restore MUST copy the selected snapshot into the current draft only; delete
MUST continue through the existing confirmation and Rules store workflow.
Snapshot origins MUST use neutral text with a familiar icon; only the current
snapshot may use the semantic success color.

#### Scenario: Compare and restore a snapshot

- Given a rule draft differs from a historical snapshot
- When the user selects that snapshot in Version History
- Then the dialog shows additions, removals, line numbers and snapshot metadata
- And the editor draft remains unchanged while comparison is open
- When the user selects Restore to Draft
- Then the snapshot content becomes the draft and the dialog closes
- And the real rule file is still unchanged until Save is selected

### `FR-AGENT-058`: Reveal The Active Rule File

The open-location action MUST ask the existing main-process shell boundary to
reveal the exact active rule file. It MUST NOT derive and submit a less specific
parent path in the renderer. A missing preload bridge, rejected invocation or
shell failure MUST produce a visible error rather than silently doing nothing.

#### Scenario: Reveal a tracked rule

- Given an active rule has an absolute file path
- When the user selects Open Location
- Then the renderer passes that exact file path to the existing shell boundary
- And the platform file manager reveals the file
- And any failure is reported without changing the draft or filesystem

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
