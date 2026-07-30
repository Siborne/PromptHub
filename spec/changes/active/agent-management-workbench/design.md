# Design

## Design Summary

The Agents workspace manages existing platform identities rather than creating a parallel Agent Profile catalog. It adds a capability-oriented adapter layer around each platform and composes existing asset services into an Agent-centered view.

```text
existing platform registry
  -> managed Agent identity and resolved paths
  -> capability adapters
       installation | provider config | session | CLI | quota | proxy(optional)
  -> Agent application services
       inspect | import | preview | activate | verify | rollback | diagnose
  -> desktop IPC/preload
  -> Agents workspace and tray

existing Skill / MCP / Rules / Plugin services
  -> Agent asset aggregation and actions
  -> no duplicate Agent-owned asset store
```

## `DES-AGENT-001`: Domain Model And Terms

### Managed Agent

A `ManagedAgent` is a view over an existing `SkillPlatform` plus device-specific detection and capabilities. Its stable id remains the existing platform id.

```ts
interface ManagedAgent {
  platform: SkillPlatform;
  installation: AgentInstallationStatus;
  capabilities: AgentCapabilitySet;
  provider: AgentProviderSummary | null;
  assets: AgentAssetSummary;
  sessions: AgentSessionSummary;
  health: AgentHealth;
}
```

No `agent_profiles` table is introduced for the first delivery.

### Provider Profile

A `ProviderProfile` is an Agent configuration source that can be activated through an adapter. It contains normalized common fields plus platform-owned extension data. It is not PromptHub's own chat model configuration and does not copy credentials.

### Universal Provider

A Universal Provider is a logical provider definition with explicit per-platform projections. It is not one JSON blob written unchanged to every Agent.

### Agent Asset State

Agent asset state is a computed aggregate of canonical Skill, MCP, Rules, and Plugin services. The Agent domain may cache a short-lived view but does not own durable asset content or assignment truth.

### Agent Profile / Persona

This remains a future composition layer. It may reference Managed Agents and assets later but is excluded from the first schema and UI.

## `DES-AGENT-002`: Sources Of Truth

| Concern                        | Source of truth                                                    | Agent workspace responsibility                                           |
| ------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Platform identity/capabilities | `packages/shared/constants/platforms.ts` and custom Agent settings | Read and present; do not duplicate                                       |
| Resolved roots/paths           | Existing platform path services and settings overrides             | Diagnose and pass to adapters                                            |
| PromptHub AI providers/models  | `CoreAIConfigService` / `config/ai-models.json`                    | Optional source for creating a Provider Profile; not native config truth |
| Agent Provider Profiles        | New SQLite records plus secure secret references                   | CRUD, test, activate, version metadata                                   |
| Active native provider         | Verified Agent config on disk                                      | Read through provider adapter; do not trust a UI boolean                 |
| Skills                         | Existing Skill DB/repos/distribution services                      | Aggregate and invoke owning actions                                      |
| MCP                            | Existing MCP library and target reconciliation                     | Aggregate and invoke owning actions                                      |
| Rules                          | Existing Rules workspace/DB services                               | Aggregate and invoke owning actions                                      |
| Plugins                        | Existing Plugin library/distribution services                      | Aggregate and invoke owning actions                                      |
| Sessions                       | Platform-owned files/logs                                          | Local metadata index and on-demand read                                  |
| Credentials                    | OS secure storage or platform-owned auth mechanism                 | Reference, readiness, projection where supported                         |

This table is a design gate. New code must not move canonical asset ownership into React state or Agent-specific JSON.

## `DES-AGENT-003`: Capability-Oriented Adapter Contracts

One giant `AgentAdapter` would force unsupported features into every platform. Use optional, typed capability adapters registered by platform id.

```ts
interface AgentInstallationAdapter {
  detect(context: AgentPathContext): Promise<AgentInstallationStatus>;
}

interface AgentProviderAdapter {
  inspect(context: AgentConfigContext): Promise<AgentNativeProviderState>;
  importCurrent(
    context: AgentConfigContext,
  ): Promise<AgentProviderImportPreview>;
  planActivation(input: AgentProviderActivationInput): Promise<AgentConfigPlan>;
  apply(plan: AgentConfigPlan): Promise<AgentConfigApplyResult>;
  verify(plan: AgentConfigPlan): Promise<AgentConfigVerification>;
  rollback(
    receipt: AgentConfigApplyReceipt,
  ): Promise<AgentConfigRollbackResult>;
}

interface AgentSessionAdapter {
  scan(input: AgentSessionScanInput): AsyncIterable<AgentSessionMetadata>;
  read(input: AgentSessionReadInput): Promise<AgentSessionTranscript>;
  getResumeCommand(session: AgentSessionMetadata): AgentResumeCommand | null;
}

interface AgentCliAdapter {
  inspect(): Promise<AgentCliStatus>;
  planInstallOrUpdate(input: AgentCliChangeInput): Promise<AgentCliChangePlan>;
  apply(plan: AgentCliChangePlan): Promise<AgentCliChangeResult>;
}
```

Optional `quota` and `proxy` contracts remain separate. Platform registration declares each capability and adapter version independently. Missing capability yields `planned` or `unsupported`, not an exception, and never removes the Agent from the workspace.

Provider and session adapters SHOULD use a platform's documented structured CLI
or local RPC before parsing internal files. File adapters are used only when no
non-mutating native interface exists and representative fixtures prove the
format. Destructive session operations are not part of the generic adapter
contract: they require a typed native command or a separately tested move-to-
trash capability.

All user-enabled built-in platforms participate in Agent discovery and display from the first delivery. Disabled built-in and custom platforms are excluded at the managed-Agent projection boundary, and settings changes refresh an already-loaded workspace. Deep-management work is prioritized rather than scope-filtered:

1. User-pinned Agents
2. Detected or explicitly configured Agents
3. Curated common Agents such as Claude Code, Codex CLI, Google Antigravity, OpenCode, Cursor, Windsurf, Cline and OpenClaw
4. Remaining enabled built-in platforms
5. Enabled custom Agents, with detected/configured custom Agents promoted by the same rules

Provider, session, config and CLI adapters may have different delivery order because each depends on format stability, security and fixture evidence. The capability matrix, not platform visibility, records implementation depth.

### Kimi Code Generation Resolution

Kimi keeps the existing stable platform id `kimi`, but root resolution is generation-aware:

1. A PromptHub user override wins.
2. A valid absolute `KIMI_CODE_HOME` selects current Kimi Code.
3. The current default `~/.kimi-code` is selected when it exists.
4. A valid absolute `KIMI_SHARE_DIR` or legacy default `~/.kimi` is used only when the current root is absent.
5. A fresh target resolves to `~/.kimi-code`; PromptHub never creates new data under the legacy root.

Current Kimi Code files are managed as separate capabilities: `config.toml` for non-secret model projection, `tui.toml` for raw allowlisted editing, `mcp.json`, `AGENTS.md`, `skills/`, `plugins/`, `session_index.jsonl`, and `sessions/`. `credentials/`, logs, update state, and arbitrary runtime files are never exposed through the config editor.

Model inspection reads `default_model`, the selected `[models.*]` entry, and its `[providers.*]` non-secret fields. Literal `api_key`, custom authorization headers, and credential documents never enter renderer payloads. Writes preserve semantic TOML fields, create a backup, replace atomically, re-read, and use `kimi doctor config` when the executable is available.

Session listing performs one bounded linear index pass, retains at most a bounded candidate window, and reads at most `O(page size)` state files with capped concurrency. Selected transcript reads are capped by bytes and line count. No recursive traversal of `sessions/` is used, so a 10,000-session inventory has `O(index bytes)` scan cost and bounded memory.

## `DES-AGENT-004`: Provider Profile Storage

### `agent_provider_profiles`

- `id TEXT PRIMARY KEY`
- `platform_id TEXT NOT NULL`
- `name TEXT NOT NULL`
- `provider_kind TEXT NOT NULL`
- `protocol TEXT NOT NULL`
- `endpoint TEXT`
- `config_json TEXT NOT NULL DEFAULT '{}'`
- `secret_ref TEXT`
- `source TEXT CHECK(manual/native-import/universal/import)`
- `archived INTEGER NOT NULL DEFAULT 0`
- `created_at`, `updated_at`

`config_json` stores validated non-secret platform-specific extension data. Adapters own schema validation; renderer cannot submit arbitrary file content.

### `agent_provider_model_mappings`

- `id TEXT PRIMARY KEY`
- `provider_profile_id TEXT NOT NULL REFERENCES agent_provider_profiles(id) ON DELETE CASCADE`
- `route_key TEXT NOT NULL`
- `model_id TEXT NOT NULL`
- `parameters_json TEXT NOT NULL DEFAULT '{}'`
- `UNIQUE(provider_profile_id, route_key)`

Route keys are adapter-defined and surfaced through typed capabilities. Common labels such as primary, fast, vision, reasoning, and fallback are UI vocabulary, not a forced platform schema.

### `agent_provider_snapshots`

- `id TEXT PRIMARY KEY`
- `platform_id TEXT NOT NULL`
- `provider_profile_id TEXT REFERENCES agent_provider_profiles(id) ON DELETE SET NULL`
- `native_digest TEXT NOT NULL`
- `redacted_snapshot TEXT NOT NULL`
- `backup_ref TEXT`
- `operation TEXT CHECK(import/activate/backfill/restore)`
- `result TEXT CHECK(planned/applied/verified/rolled-back/failed)`
- `created_at INTEGER NOT NULL`

Snapshot rows contain redacted structural state. Native backup file paths use device-local references and are excluded from portable export.

### `agent_universal_providers` And Projections

Universal providers are follow-up schema, not required for the first migration. When added, each projection maps a universal id to a platform-specific Provider Profile and records unsupported fields explicitly.

### Migration

- Add fresh schema and idempotent existing-user migration in `packages/db`.
- Do not mutate existing platform settings or PromptHub AI configuration.
- Do not infer Provider Profiles from native files during migration; import is explicit.
- Add indexes for platform, archive state, update time, and snapshot history.

## `DES-AGENT-005`: Credential Strategy

Credential handling has three cases:

1. **PromptHub-owned secret**: store in OS secure storage through a stable `secret_ref`; never return the value to renderer after save.
2. **Platform-owned OAuth/keychain**: preserve the native mechanism and expose readiness only. Do not copy or export tokens.
3. **Native config requires plaintext/env value**: resolve the secret in main/core only during activation, write only the adapter-required target, then verify and redact diagnostics.

The first implementation must audit the existing AI configuration secret behavior before sharing connections. Provider Profiles may offer “create from PromptHub provider” only when protocol and credential semantics are compatible. It must create a mapping, not alias two mutable JSON records.

Backup rules:

- Default backups contain secret requirements and references, not secret values.
- A future encrypted credential export requires a separate explicit format, user password, authenticated encryption, and dedicated threat model.
- Deep links with literal credentials are treated as transient sensitive input and never logged.

Claude Code Provider Profiles use `config_json.credentialEnvKey` only for the
allowlisted values `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN`. The matching
secret remains under PromptHub main-process custody and is projected only into
`~/.claude/settings.json` after preview and confirmation. A
`platform-native` Claude Profile removes PromptHub-managed direct-provider env
keys and leaves Claude's own OAuth/keychain flow in control. PromptHub never
reads, writes, migrates, backs up or exports Claude-owned `.credentials.json`.

## `DES-AGENT-006`: Native Config Reconciliation And Activation

Every supported switch follows:

`inspect -> normalize -> compare baseline/current/desired -> preview -> backup -> stage -> atomic replace -> re-read -> verify -> record`

The comparison is three-way:

- baseline: last verified PromptHub projection, if any
- current: current native config read immediately before apply
- desired: adapter projection from selected Provider Profile

Plan classifications:

- `apply`: managed field can be changed safely
- `preserve`: unrelated or unknown field remains unchanged
- `backfill`: current native value can update the PromptHub profile after confirmation
- `external-modified`: managed field changed outside PromptHub
- `conflict`: current and desired both diverge from baseline
- `unsupported`: adapter cannot represent requested configuration
- `blocked`: secret, permission, validation, or path prerequisite is missing

Apply rules:

- Use structured parsers/writers for JSON, JSONC, TOML, YAML, or dotenv as appropriate.
- Never use ad hoc string replacement for structured files.
- Preserve comments/order when the selected parser supports it; otherwise preview formatting changes explicitly.
- Resolve and validate paths against allowlisted platform roots.
- Create backup before replacing an existing file.
- Use a same-directory staging file and atomic rename where supported.
- Re-read and verify semantic state after write.
- Restore backup when write or verification fails.
- Record active provider only from verified native state.

Concurrent changes are handled by a digest check immediately before rename. A changed digest invalidates the plan and returns to preview.

## `DES-AGENT-007`: Agent Asset Aggregation

Create an application-level `AgentAssetAggregationService` that depends on public services from the existing domains:

```ts
interface AgentAssetDomainAdapter {
  readonly kind: "skill" | "mcp" | "rule" | "plugin";
  listForTarget(platformId: string): Promise<AgentAssetTargetState[]>;
  planAction(input: AgentAssetActionInput): Promise<AgentAssetActionPlan>;
  applyAction(plan: AgentAssetActionPlan): Promise<AgentAssetActionResult>;
}
```

Rules:

- The Agent workspace does not write asset tables/files directly.
- Every action uses the owning domain's existing validation, reconciliation and rollback behavior.
- Counts, list rows, detail badges and tray summaries derive from the same aggregate selector.
- Missing adapter support is shown per asset kind.
- The first delivery adds no generic `agent_asset_bindings` table.

## `DES-AGENT-008`: Sessions And Usage

### Metadata Index

Introduce device-local session sources and metadata indexes only for verified formats:

- `agent_session_sources`: platform, root, adapter version, scan cursor, enabled, last result.
- `agent_sessions`: external id, platform, title, project path, timestamps, message count, bounded preview, source path/digest/status, tags/note.

Transcript bodies remain in source files and are loaded on demand. Index rows are excluded from normal cloud sync unless a future explicit metadata policy is added.

### Scan Safety

- Opt-in per source where content sensitivity warrants it.
- Bounded file count, size, preview, parse time, and concurrency.
- Incremental scan using path, mtime, size, digest and adapter version.
- Cancellation and progress events.
- Symlink escape, traversal and null-byte rejection.
- Per-file parse failures without aborting the inventory.
- Redaction before previews or diagnostics are persisted.

The first adapters MUST NOT recursively parse entire platform roots. OpenCode
and OpenClaw use bounded native JSON commands. Claude may use a bounded file
metadata adapter with tolerant JSONL parsing because its first-party docs expose
the transcript location while warning that entry schemas are internal. Codex
uses `session_index.jsonl`/SQLite metadata first and reads rollout files only for
the selected page; multi-gigabyte rollout files must remain loadable as bounded
partial results.

### Resume

Adapters return executable plus argument arrays, never a renderer-built shell string. UI may copy a quoted display command, but main process launch uses `execFile`-style invocation.

### Session Management

- Search, metadata browse, bounded detail view, source diagnostics, and resume
  are the common baseline.
- Transcript contents are never edited by PromptHub.
- Platform-native delete/retention/cleanup commands may be exposed as typed
  adapter actions with preview and confirmation.
- Raw transcript files are never permanently deleted through a generic file
  operation. A future fallback must use operating-system trash and prove
  rollback behavior.

### Usage

P1 usage summaries derive from verified session logs. Proxy-observed usage and provider-reported quota remain separate data sources with labels and timestamps.

## `DES-AGENT-009`: Provider And Model Testing

Provider tests run in main/core and never mutate the active Agent configuration.
The capability is split into two explicit levels so the UI does not confuse
endpoint reachability with a billable model inference:

1. **Connection inventory check**: a bounded, read-only protocol request that
   verifies endpoint policy, authentication and model discovery.
2. **Streaming model test**: an explicit user action that performs a minimal
   inference and records first-token timing. It requires a quota confirmation
   and remains separate from activation because it can consume provider quota.

The Codex OpenAI-compatible connection inventory check resolves the unified
Provider Profile, model mapping and secure secret only in main memory. It calls
`GET /models` with zero retries, an 8-second total timeout, a 1 MiB response
limit and no redirects. Public endpoints require HTTPS; explicit loopback HTTP
is allowed for a user-owned local provider; other private, link-local and
internal addresses are rejected after DNS resolution. The result returns only
the endpoint origin, model count/presence, stable status and elapsed time.
Query, fragment, userinfo, response bodies, native paths and credentials never
cross IPC.

Result fields:

- adapter/protocol/provider profile id
- tested model and endpoint origin, with sensitive query values removed
- started/finished timestamps
- DNS/connect/TLS/request/first-token/total durations when available
- success, HTTP category, protocol category, retry count
- bounded redacted response preview only when safe

The streaming test uses OpenAI Responses or Chat Completions SSE according to
the stored protocol. It sends one fixed minimal prompt with an 8-token output
cap, uses 5-second connect, 8-second first-token and 20-second total deadlines,
permits at most one retry for a bounded transient category, rejects redirects
and unsafe targets, and caps the response at 256 KiB. Only a control-character
free, credential-redacted 256-character preview crosses IPC. Profile switches,
explicit cancellation and renderer destruction abort the main-owned request.
The adapter builds every test request from the Provider Profile and secure
secret reference without reading the active native projection as a second
source of truth.

Claude Code uses the same two-level test contract with Anthropic's native
protocol: `GET /v1/models` for inventory and `POST /v1/messages` with SSE for
the explicit minimal model test. `ANTHROPIC_API_KEY` maps to `x-api-key`;
`ANTHROPIC_AUTH_TOKEN` maps to `Authorization: Bearer`. The probe shares the
HTTPS/explicit-loopback, DNS pinning, redirect, timeout, response-size, retry,
cancellation and redaction boundaries above. IP endpoints omit TLS SNI because
Node rejects IP literals as `servername`.

Gemini CLI keeps its enterprise/paid-API compatibility identity separate from
Antigravity. The complete Gemini adapter owns a two-file runtime projection:

- `~/.gemini/settings.json`: `model.name` and
  `security.auth.selectedType` only, edited as JSONC while preserving unrelated
  fields and comments.
- `~/.gemini/.env`: only the managed `GEMINI_API_KEY` and optional
  `GOOGLE_GEMINI_BASE_URL` entries. Other variables, comments and formatting
  remain byte-stable where possible.

Managed paid API profiles use protocol `google-generative-ai`, auth type
`gemini-api-key`, and a main-only `agent-provider:<profileId>` secret. The
default endpoint is `https://generativelanguage.googleapis.com`; an override
must use HTTPS or explicit loopback HTTP. Connection inventory calls bounded
`GET /v1beta/models`; the explicit model test calls bounded
`POST /v1beta/models/{model}:streamGenerateContent?alt=sse`. Both authenticate
with `x-goog-api-key`, reject redirects and unsafe DNS targets, and share the
existing timeout, response-cap, retry, cancellation and redaction contract.

Platform-native profiles may preserve the documented non-secret auth types
`oauth-personal`, `vertex-ai`, `compute-default-credentials`, `cloud-shell` and
`gateway`. PromptHub does not read or migrate Gemini keychain data,
`oauth_creds.json`, ADC/service-account files, or Antigravity credentials.
Native-auth connection and model tests report unsupported instead of borrowing
those credentials. Activation uses one encrypted bundle backup, checks both
files for concurrent edits, writes each atomically, rereads both, and restores
both on any partial failure.

## `DES-AGENT-010`: UI Information Architecture

### Global Navigation

Add `Agents` as a first-class left-rail module. Its default position is second,
immediately after `Prompts` and before `Skills`. New settings use that canonical
order. The settings v17 migration maps only recognized historical defaults to
it; current-version hydration preserves complete user-defined orders, including
an order that happens to equal the former default. Existing settings for Agent
roots become advanced platform/path settings and link back to the corresponding
Agent detail.

### Workspace Layout

- Left/local list: enabled Agents with one search field; status and sort filter controls are intentionally omitted.
- The list contains enabled built-in and enabled custom Agents. It is never reduced to platforms with provider/session adapters, but user-disabled platforms are not displayed.
- Default order is pinned, detected/configured, curated common priority, then stable name order. Search operates over the enabled set.
- Agent row: icon, name, detection/version, current provider/model, health, asset/session summary.
- Main detail header: Agent identity, status, current provider, diagnose, quick actions.
- Tabs:
  - Overview
  - Provider & Model
  - Appearance
  - Skills
  - MCP
  - Rules
  - Plugins
  - Config Files
  - Sessions
  - Usage
  - Maintenance

Tabs are capability-aware. Overview and supported asset/path information remain available for every Agent. Unsupported deep capabilities show `partial`, `planned`, or `unsupported` with a reason instead of hiding the Agent or presenting a broken empty page.

### Appearance Adapter

Appearance is a first-class Agent capability with one shared page and optional
adapter-owned sections. The initial Codex adapter exposes native appearance,
desktop skins, and Pets. Other Agents retain the same tab position and declare
`planned` or `unsupported` until an adapter is verified.

Imported Codex Dream Skin directories are stored beneath PromptHub's resolved
data directory at `agent-appearance/themes/codex/<theme-id>`. Each directory
contains declaration-only `theme.json` metadata and one local PNG, JPEG, or
WebP image. The directory is the source of truth; SQLite stores no duplicate CSS
or image payload. PromptHub vendors the audited software-only runtime from
`Fei-Away/Codex-Dream-Skin` version `1.2.0`, commit
`3af1d6d62f3a0388cc640d2f497ac3100998938e`. The renderer receives only
normalized metadata and action results, never an unrestricted CDP handle.

Desktop skin execution belongs to the Electron main process and its managed
Dream Skin host process. PromptHub stages the selected theme into the upstream
platform runtime and invokes its start, verification, watch/reinject, and restore
flows. The runtime binds only to loopback, validates that the listener belongs
to the official Codex process, validates `app://` renderer landmarks, injects the
vendored CSS/renderer payload, and removes the payload plus debugging session on
restore. macOS reuses the signed Node runtime bundled with Codex. Windows follows
the upstream Node 22 runtime requirement and reports a bounded actionable error
when that prerequisite is absent.

Theme imports reject traversal, symlinks, reparse points, non-local image paths,
malformed JSON, unsupported image formats, empty images, files over 16 MB,
dimensions over 16384px, and images over 50 megapixels. Theme staging publishes
the image before `theme.json` by atomic rename so the watcher never observes a
partial pair. The application bundle, `app.asar`, and signature are never
patched. PromptHub packages the upstream MIT license, notice, pinned commit, and
local modifications. Celebrity, character, sponsor, and other rights-unclear
upstream presets are excluded; only software and the upstream abstract demo
artwork may be redistributed.

The sibling checkout under `Programs/public/Codex-Dream-Skin` is an audit and
update source only. Production and development builds MUST use the pinned
runtime snapshot inside PromptHub and MUST NOT execute mutable code from that
sibling checkout or from imported theme directories.

Codex Pets remain platform-owned at `<codex-root>/pets/<pet-id>`. A valid package
contains `pet.json` and a local PNG or WebP spritesheet declared by the manifest.
The main process resolves real paths, enforces containment, rejects symlinks and
oversized files, normalizes the Codex sprite contract version, and exposes the
spritesheet through a bounded data URL. The renderer treats the sheet as an
8-column atlas and clips one `192x208`-ratio cell inside a stable preview
viewport. It advances through the six standard idle frames using the Codex idle
timing sequence; v1 uses nine rows and v2 uses eleven rows. The source atlas is
never rendered as a whole-card `<img>`. `prefers-reduced-motion: reduce` pins the
preview to idle frame zero. Import uses atomic staging and rename; delete is
scoped to one validated child directory. Pet files remain outside PromptHub
backup and sync unless a later change adds an explicit portable-asset contract.

All Agents use the same detail shell and stable tab/action placement. Capability state changes control availability, not layout:

- The Agent row, Overview, and detail shell are always clickable.
- `supported` actions are enabled.
- `partial` actions are enabled only for the supported sub-actions; unavailable sub-actions are disabled.
- `planned` and `unsupported` actions remain visible but disabled, with a concise reason in a tooltip or adjacent status label.
- Disabled controls must not open an empty panel, invoke IPC, or imply that installing the Agent will automatically add an unsupported adapter.
- Capability changes must not reorder tabs or cause platform-specific page variants.

### Provider And Model

- Current verified provider and native config status.
- Provider Profile list with activate, test, duplicate, edit, import-current and export actions.
- Diff preview uses field-level rows and masked sensitive values.
- Universal provider projections appear only after P1 support exists.

### Asset Domains

Skills, MCP, Rules and Plugins are direct top-level tabs in the shared Agent shell. Do not add a generic Assets tab, segmented control, or secondary asset navigation. Each page shows installed, available, drifted, blocked and unsupported states for its own domain. Canonical editing opens the owning workspace.

### Config Files

The platform registry and user path overrides remain the source of truth for config-relative paths. The Managed Agent projection resolves both the Agent root and normalized relative config paths; React does not guess filenames.

The first config-file batch reuses the existing local file tree/code editor in a constrained mode:

- the editor base is the resolved Agent root;
- only declared config-relative paths and their parent directories are listed;
- missing allowlisted text files may be created by saving them;
- content editing and save are enabled, while rename, delete, arbitrary file creation and arbitrary folder creation are disabled;
- Open Agent folder delegates to the existing validated shell path action;
- authentication artifacts, session stores, logs, caches and databases are not added to the config allowlist;
- no PromptHub snapshot, version or restore record is created in this batch.

Verified initial declarations include Claude Code `settings.json`, Codex CLI `config.toml`, Gemini CLI `settings.json`, OpenCode `opencode.json`, and Cline's non-credential settings files. Additional platforms use the same UI when their registry metadata is verified; otherwise the stable Config Files tab remains disabled.

Structured adapters, redacted diffs, snapshots and restore remain a later capability layer. They must compose with this file inventory rather than introduce a second path source.

### Sessions And Usage

Sessions use a searchable, virtualized list and transcript reader. Usage labels evidence source and freshness. Unsupported platforms show the reason, not a blank panel.

### Maintenance

Show executable source/version, update status, roots, permissions, adapter versions, re-detect, open folder, export diagnostics and future install/update actions.

## `DES-AGENT-011`: Tray Integration

The tray menu is a projection of the same Agent query and activation services:

- Agents submenu
- current provider/model state per supported Agent
- alternate Provider Profiles
- open Agent detail
- diagnose or report failure

Tray must not bypass preview policy. For quick switching, the previous accepted preview can be summarized in a confirmation dialog; new conflicts force the full workspace preview.

## `DES-AGENT-012`: Backup, Import, And Deep Links

### Backup

Extend the structured backup envelope with optional versioned sections:

- provider profiles
- model mappings
- redacted snapshot metadata
- Agent workspace preferences
- session source preferences, but not transcript bodies

Restore order:

1. Existing canonical assets and settings
2. Provider Profiles and mappings
3. Agent path resolution and capability detection
4. Secret readiness and native config reconciliation
5. Optional local session rescan

### Portable Export

Provider Profile export includes platform id, protocol, endpoint, model mappings, non-secret config, required secret labels and format version. It excludes active native file snapshots, local backup paths and credentials.

### Deep Link

P1 may introduce `prompthub://import?...` with:

- versioned payload schema and strict maximum length
- allowed object type and URL protocol validation
- decoded redacted preview
- explicit confirmation
- no automatic provider activation
- no logging of raw URL or secret fields

## `DES-AGENT-013`: Proxy And Failover Boundary

Proxy/failover is a future subsystem, not part of provider activation:

- owns local listeners, protocol adapters, routing, health checks, failover queues and request accounting
- requires explicit enablement and visible port/bind configuration
- must never intercept traffic merely because a Provider Profile was selected
- uses separate logs, retention, redaction, threat model and performance tests
- integrates through an optional `AgentProxyAdapter` projection

OAuth reverse proxy and non-public authentication flows require a separate legal/security review and are not assumed to be part of parity.

## `DES-AGENT-014`: Package And Process Ownership

### `packages/shared`

- serializable contracts, capability/status enums and IPC channel names
- no secret values, unrestricted native config, or Electron imports

### `packages/db`

- Provider Profile, model mapping, redacted snapshot, session source/index primitives
- schema, migration, indexes and transactions
- no filesystem inspection or platform parsing

### `packages/core`

- Agent query/orchestration services
- adapter interfaces and registry
- provider reconciliation/planning policy
- asset aggregation contracts
- backup normalization and redaction policy

### Desktop Main

- platform-specific filesystem/process/network adapters
- secure storage bridge
- provider apply/verify/rollback
- session scan/read/resume
- CLI inspection and future installation

### Preload

Expose an `agent` domain composed from smaller modules. Keep existing `window.api`/`window.electron` compatibility.

### Renderer

- list/detail loading, filters, view state and user workflow orchestration
- no direct filesystem, secure storage, native config parsing or canonical asset mutation

## `DES-AGENT-015`: Security And Failure Boundaries

- Validate DTOs, enums, object depth, array length and payload size at IPC.
- Reject traversal, null bytes, device paths, unsafe symlinks and writes outside resolved roots.
- Use executable plus argument arrays; do not interpolate untrusted shell commands.
- Restrict network tests to adapter-approved HTTP(S) protocols, explicit endpoints, redirect limits and private-address policy.
- Redact Authorization, API keys, tokens, cookies, query secrets, env secrets and native config bodies.
- Mark partial results per platform/action; never collapse multi-Agent operations into false global success.
- Keep backups bounded by count/age and exclude them from normal sync.
- Use operation ids and cancellation for scans/tests; ignore late results after cancellation.
- Record adapter version with snapshots so future parsers can explain drift.

## `DES-AGENT-016`: Phased Delivery

### Phase 0: Foundations

- Managed Agent query over the complete existing registry, including stable priority metadata and capability states
- capability contracts and adapter registry
- secure secret abstraction
- Provider Profile schema and backup contract
- fixture and failure harness

### Phase 1: Core CC Switch Parity

- Agents workspace and overview for all built-in and enabled custom Agents
- Claude Code, Codex CLI, Gemini CLI provider adapters
- import/backfill/preview/activate/verify/rollback
- provider/model test
- asset aggregation
- tray switching
- two session adapters

### Phase 2: Breadth And Operations

- Continue adapter coverage across every preset platform according to the capability inventory
- Universal Providers
- quota/model refresh
- CLI install/update/diagnostics
- usage summaries
- deep-link import

### Phase 3: High-Risk Routing

- local proxy and protocol conversion
- failover queues and request telemetry
- optional encrypted sensitive sync
- separately approved OAuth capabilities

## `DES-AGENT-017`: Google Antigravity Product Boundary

Google transitioned the consumer terminal experience from Gemini CLI to
Antigravity CLI (`agy`). Since 2026-06-18, Free, Google AI Pro and Ultra users
are served through Antigravity; Gemini CLI remains supported only for enterprise
licenses, Google Cloud and paid Gemini API keys. PromptHub therefore:

- prioritizes `antigravity` as the current Google Agent;
- marks `gemini` as `enterprise-legacy` with `antigravity` as its replacement;
- preserves the existing `gemini` id, root and adapters for compatibility rather than deleting or silently migrating user data.

The `antigravity` platform represents the shared Antigravity customization surface:

- managed root: `~/.gemini/config`
- Skills: `skills/`
- MCP: `mcp_config.json`
- Plugins: `plugins/`
- global Rules: `../GEMINI.md`
- CLI preferences: `../antigravity-cli/settings.json`

The desktop runtime root `~/.gemini/antigravity` and CLI runtime root
`~/.gemini/antigravity-cli` contain product-owned conversations, artifacts,
caches, credentials, and updater state. They remain discovery/session adapter
inputs only and are not generic asset distribution targets.

## `DES-AGENT-018`: Traceability

| Requirements                                                                                                          | Design                                                                                                                                                 | Verification                                                                                                                                                                                         | Tasks                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FR-AGENT-001`, `FR-AGENT-002`, `FR-AGENT-018`, `FR-AGENT-019`                                                        | `DES-AGENT-001`, `DES-AGENT-002`, `DES-AGENT-003`, `DES-AGENT-010`, `DES-AGENT-014`, `DES-AGENT-016`, `DES-AGENT-032`                                  | `TEST-AGENT-001`, `TEST-AGENT-002`, `TEST-AGENT-016`, `TEST-AGENT-019`, `TEST-AGENT-021`, `TEST-AGENT-045`                                                                                           | `T-AGENT-001`, `T-AGENT-002`, `T-AGENT-003`, `T-AGENT-004`, `T-AGENT-006`, `T-AGENT-009`, `T-AGENT-010`, `T-AGENT-011`, `T-AGENT-013`, `T-AGENT-014`, `T-AGENT-020`, `T-AGENT-021B`, `T-AGENT-026`, `T-AGENT-026A`, `T-AGENT-034`, `T-AGENT-073`, `T-AGENT-076`                             |
| `FR-AGENT-003`, `FR-AGENT-004`, `FR-AGENT-005`, `FR-AGENT-006`, `FR-AGENT-007`                                        | `DES-AGENT-004`, `DES-AGENT-005`, `DES-AGENT-006`, `DES-AGENT-012`, `DES-AGENT-033`, `DES-AGENT-034`, `DES-AGENT-035`                                  | `TEST-AGENT-003`, `TEST-AGENT-004`, `TEST-AGENT-005`, `TEST-AGENT-006`, `TEST-AGENT-007`, `TEST-AGENT-015`, `TEST-AGENT-051`, `TEST-AGENT-052`, `TEST-AGENT-053`                                     | `T-AGENT-005`, `T-AGENT-007`, `T-AGENT-012`, `T-AGENT-015`, `T-AGENT-016`, `T-AGENT-017`, `T-AGENT-018`, `T-AGENT-019`, `T-AGENT-020`, `T-AGENT-027`, `T-AGENT-074`, `T-AGENT-075`, `T-AGENT-077`, `T-AGENT-078`, `T-AGENT-079`, `T-AGENT-086`, `T-AGENT-087`, `T-AGENT-088`, `T-AGENT-100` |
| `FR-AGENT-008`                                                                                                        | `DES-AGENT-002`, `DES-AGENT-007`                                                                                                                       | `TEST-AGENT-008`, `TEST-AGENT-017`                                                                                                                                                                   | `T-AGENT-013`, `T-AGENT-021`, `T-AGENT-060`, `T-AGENT-076`                                                                                                                                                                                                                                  |
| `FR-AGENT-009`                                                                                                        | `DES-AGENT-006`, `DES-AGENT-010`, `DES-AGENT-015`                                                                                                      | `TEST-AGENT-006`, `TEST-AGENT-009`                                                                                                                                                                   | `T-AGENT-015`, `T-AGENT-021`, `T-AGENT-021A`                                                                                                                                                                                                                                                |
| `FR-AGENT-010`, `FR-AGENT-015`                                                                                        | `DES-AGENT-008`, `DES-AGENT-045`, `DES-AGENT-046`, `DES-AGENT-047`, `DES-AGENT-053`, `DES-AGENT-064` in `session-index-designs.md`                     | `TEST-AGENT-010`, `TEST-AGENT-011`, `TEST-AGENT-040`, `TEST-AGENT-063`, `TEST-AGENT-064`, `TEST-AGENT-065`, `TEST-AGENT-072`, `TEST-AGENT-082`                                                       | `T-AGENT-008`, `T-AGENT-016`, `T-AGENT-022`, `T-AGENT-028`, `T-AGENT-030`, `T-AGENT-067`, `T-AGENT-069`, `T-AGENT-098`, `T-AGENT-099`, `T-AGENT-101`, `T-AGENT-108`, `T-AGENT-119`                                                                                                          |
| `FR-AGENT-011`                                                                                                        | `DES-AGENT-009`, `DES-AGENT-015`, `DES-AGENT-033`, `DES-AGENT-034`, `DES-AGENT-035`                                                                    | `TEST-AGENT-012`, `TEST-AGENT-050`, `TEST-AGENT-051`, `TEST-AGENT-052`, `TEST-AGENT-053`                                                                                                             | `T-AGENT-017`, `T-AGENT-018`, `T-AGENT-019`, `T-AGENT-085`, `T-AGENT-086`, `T-AGENT-087`, `T-AGENT-088`                                                                                                                                                                                     |
| `FR-AGENT-012`                                                                                                        | `DES-AGENT-011`, `DES-AGENT-048`, `DES-AGENT-050` in `tray-provider-designs.md`                                                                        | `TEST-AGENT-013`, `TEST-AGENT-066`, `TEST-AGENT-069`                                                                                                                                                 | `T-AGENT-024`, `T-AGENT-102`, `T-AGENT-105`                                                                                                                                                                                                                                                 |
| `FR-AGENT-013`, `FR-AGENT-016`                                                                                        | `DES-AGENT-012`; `DES-AGENT-061` in `deep-link-designs.md`                                                                                             | `TEST-AGENT-014`, `TEST-AGENT-015`, `TEST-AGENT-079`                                                                                                                                                 | `T-AGENT-023`, `T-AGENT-031`, `T-AGENT-116`                                                                                                                                                                                                                                                 |
| `FR-AGENT-014`                                                                                                        | `DES-AGENT-003`, `DES-AGENT-010`, `DES-AGENT-014`, `DES-AGENT-049`, `DES-AGENT-059`, `DES-AGENT-063`, `DES-AGENT-065` in `maintenance-cli-designs.md`  | `TEST-AGENT-016`, `TEST-AGENT-067`, `TEST-AGENT-068`, `TEST-AGENT-078`, `TEST-AGENT-081`, `TEST-AGENT-083`                                                                                           | `T-AGENT-029`, `T-AGENT-103`, `T-AGENT-104`, `T-AGENT-114`, `T-AGENT-118`, `T-AGENT-120`                                                                                                                                                                                                    |
| `FR-AGENT-017`                                                                                                        | `DES-AGENT-013`, `DES-AGENT-016`                                                                                                                       | separate change                                                                                                                                                                                      | `T-AGENT-032`, `T-AGENT-033`                                                                                                                                                                                                                                                                |
| `FR-AGENT-020`                                                                                                        | `DES-AGENT-003`, `DES-AGENT-010`, `DES-AGENT-014`, `DES-AGENT-015`                                                                                     | `TEST-AGENT-020`                                                                                                                                                                                     | `T-AGENT-026B`                                                                                                                                                                                                                                                                              |
| `FR-AGENT-021`                                                                                                        | `DES-AGENT-001`, `DES-AGENT-002`, `DES-AGENT-003`, `DES-AGENT-017`                                                                                     | `TEST-AGENT-022`                                                                                                                                                                                     | `T-AGENT-026C`                                                                                                                                                                                                                                                                              |
| `FR-AGENT-022`, `FR-AGENT-023`                                                                                        | `DES-AGENT-019`                                                                                                                                        | `TEST-AGENT-023`, `TEST-AGENT-024`                                                                                                                                                                   | `T-AGENT-040`, `T-AGENT-041`, `T-AGENT-042`, `T-AGENT-043`, `T-AGENT-044`                                                                                                                                                                                                                   |
| `FR-AGENT-024`                                                                                                        | `DES-AGENT-020`                                                                                                                                        | `TEST-AGENT-004`, `TEST-AGENT-005`, `TEST-AGENT-007`, `TEST-AGENT-013`, `TEST-AGENT-025`, `TEST-AGENT-026`, `TEST-AGENT-027`, `TEST-AGENT-049`                                                       | `T-AGENT-045`, `T-AGENT-046`, `T-AGENT-047`, `T-AGENT-048`, `T-AGENT-049`, `T-AGENT-079`, `T-AGENT-084`                                                                                                                                                                                     |
| `FR-AGENT-025`                                                                                                        | `DES-AGENT-021`                                                                                                                                        | `TEST-AGENT-028`                                                                                                                                                                                     | `T-AGENT-050`, `T-AGENT-051`, `T-AGENT-052`                                                                                                                                                                                                                                                 |
| `FR-AGENT-026`                                                                                                        | `DES-AGENT-022`                                                                                                                                        | `TEST-AGENT-029`, `TEST-AGENT-030`, `TEST-AGENT-031`                                                                                                                                                 | `T-AGENT-053`, `T-AGENT-054`, `T-AGENT-055`, `T-AGENT-056`                                                                                                                                                                                                                                  |
| `FR-AGENT-027`                                                                                                        | `DES-AGENT-023`                                                                                                                                        | `TEST-AGENT-032`, `TEST-AGENT-033`, `TEST-AGENT-035`, `TEST-AGENT-037`, `TEST-AGENT-041`                                                                                                             | `T-AGENT-057`, `T-AGENT-058`, `T-AGENT-059`, `T-AGENT-061`, `T-AGENT-065`, `T-AGENT-070`                                                                                                                                                                                                    |
| `FR-AGENT-028`                                                                                                        | `DES-AGENT-024`                                                                                                                                        | `TEST-AGENT-034`                                                                                                                                                                                     | `T-AGENT-060`                                                                                                                                                                                                                                                                               |
| `FR-AGENT-029`                                                                                                        | `DES-AGENT-003`, `DES-AGENT-007`, `DES-AGENT-008`, `DES-AGENT-014`, `DES-AGENT-015`, `DES-AGENT-025`; `DES-AGENT-062` in `platform-adapter-designs.md` | `TEST-AGENT-036`, `TEST-AGENT-080`                                                                                                                                                                   | `T-AGENT-062`, `T-AGENT-063`, `T-AGENT-064`, `T-AGENT-117`                                                                                                                                                                                                                                  |
| `FR-AGENT-030`                                                                                                        | `DES-AGENT-026`                                                                                                                                        | `TEST-AGENT-038`                                                                                                                                                                                     | `T-AGENT-067`                                                                                                                                                                                                                                                                               |
| `FR-AGENT-031`                                                                                                        | `DES-AGENT-027`                                                                                                                                        | `TEST-AGENT-039`                                                                                                                                                                                     | `T-AGENT-068`                                                                                                                                                                                                                                                                               |
| `FR-AGENT-032`                                                                                                        | `DES-AGENT-028`                                                                                                                                        | `TEST-AGENT-040`                                                                                                                                                                                     | `T-AGENT-069`                                                                                                                                                                                                                                                                               |
| `FR-AGENT-033`                                                                                                        | `DES-AGENT-029`                                                                                                                                        | `TEST-AGENT-042`                                                                                                                                                                                     | `T-AGENT-071`                                                                                                                                                                                                                                                                               |
| `FR-AGENT-034`                                                                                                        | `DES-AGENT-030`                                                                                                                                        | `TEST-AGENT-043`                                                                                                                                                                                     | `T-AGENT-072`                                                                                                                                                                                                                                                                               |
| `FR-AGENT-035`                                                                                                        | `DES-AGENT-031`                                                                                                                                        | `TEST-AGENT-044`                                                                                                                                                                                     | `T-AGENT-026D`                                                                                                                                                                                                                                                                              |
| `FR-AGENT-036`                                                                                                        | `DES-AGENT-036`                                                                                                                                        | `TEST-AGENT-054`                                                                                                                                                                                     | `T-AGENT-089`                                                                                                                                                                                                                                                                               |
| `FR-AGENT-037`                                                                                                        | `DES-AGENT-037`                                                                                                                                        | `TEST-AGENT-055`                                                                                                                                                                                     | `T-AGENT-090`                                                                                                                                                                                                                                                                               |
| `FR-AGENT-038`                                                                                                        | `DES-AGENT-038` in `platform-adapter-designs.md`                                                                                                       | `TEST-AGENT-056`                                                                                                                                                                                     | `T-AGENT-091`                                                                                                                                                                                                                                                                               |
| `FR-AGENT-039`                                                                                                        | `DES-AGENT-039` in `platform-adapter-designs.md`                                                                                                       | `TEST-AGENT-057`                                                                                                                                                                                     | `T-AGENT-092`                                                                                                                                                                                                                                                                               |
| `FR-AGENT-040`                                                                                                        | `DES-AGENT-040` in `platform-adapter-designs.md`                                                                                                       | `TEST-AGENT-058`                                                                                                                                                                                     | `T-AGENT-093`                                                                                                                                                                                                                                                                               |
| `FR-AGENT-041`                                                                                                        | `DES-AGENT-041` in `platform-adapter-designs.md`                                                                                                       | `TEST-AGENT-059`                                                                                                                                                                                     | `T-AGENT-094`                                                                                                                                                                                                                                                                               |
| `FR-AGENT-042`                                                                                                        | `DES-AGENT-042` in `platform-adapter-designs.md`                                                                                                       | `TEST-AGENT-060`                                                                                                                                                                                     | `T-AGENT-095`                                                                                                                                                                                                                                                                               |
| `FR-AGENT-043`                                                                                                        | `DES-AGENT-043` in `platform-adapter-designs.md`                                                                                                       | `TEST-AGENT-061`                                                                                                                                                                                     | `T-AGENT-096`                                                                                                                                                                                                                                                                               |
| `FR-AGENT-044`                                                                                                        | `DES-AGENT-044` in `provider-credential-designs.md`                                                                                                    | `TEST-AGENT-062`                                                                                                                                                                                     | `T-AGENT-097`                                                                                                                                                                                                                                                                               |
| `FR-AGENT-045`                                                                                                        | `DES-AGENT-051` in `provider-credential-designs.md`                                                                                                    | `TEST-AGENT-070`                                                                                                                                                                                     | `T-AGENT-106`                                                                                                                                                                                                                                                                               |
| `FR-AGENT-046`                                                                                                        | `DES-AGENT-052` in `provider-credential-designs.md`                                                                                                    | `TEST-AGENT-071`                                                                                                                                                                                     | `T-AGENT-107`                                                                                                                                                                                                                                                                               |
| `FR-AGENT-047`                                                                                                        | `DES-AGENT-053` in `session-index-designs.md`                                                                                                          | `TEST-AGENT-072`                                                                                                                                                                                     | `T-AGENT-108`                                                                                                                                                                                                                                                                               |
| `FR-AGENT-048`                                                                                                        | `DES-AGENT-054` in `backup-portability-designs.md`                                                                                                     | `TEST-AGENT-073`                                                                                                                                                                                     | `T-AGENT-109`                                                                                                                                                                                                                                                                               |
| `FR-AGENT-049`                                                                                                        | `DES-AGENT-055` in `backup-portability-designs.md`                                                                                                     | `TEST-AGENT-074`                                                                                                                                                                                     | `T-AGENT-110`                                                                                                                                                                                                                                                                               |
| `FR-AGENT-050`                                                                                                        | `DES-AGENT-056` in `backup-portability-designs.md`                                                                                                     | `TEST-AGENT-075`                                                                                                                                                                                     | `T-AGENT-111`                                                                                                                                                                                                                                                                               |
| `FR-AGENT-051`                                                                                                        | `DES-AGENT-066` in `ui-design.md`                                                                                                                      | `TEST-AGENT-084`                                                                                                                                                                                     | `T-AGENT-121`                                                                                                                                                                                                                                                                               |
| `FR-AGENT-052`                                                                                                        | `DES-AGENT-067` in `ui-design.md`                                                                                                                      | `TEST-AGENT-085`                                                                                                                                                                                     | `T-AGENT-122`                                                                                                                                                                                                                                                                               |
| `FR-AGENT-053`                                                                                                        | `DES-AGENT-068` in `ui-design.md`                                                                                                                      | `TEST-AGENT-086`                                                                                                                                                                                     | `T-AGENT-123`                                                                                                                                                                                                                                                                               |
| `FR-AGENT-054`                                                                                                        | `DES-AGENT-069` in `ui-design.md`                                                                                                                      | `TEST-AGENT-087`                                                                                                                                                                                     | `T-AGENT-124`                                                                                                                                                                                                                                                                               |
| `FR-AGENT-055`                                                                                                        | `DES-AGENT-070` in `ui-design.md`                                                                                                                      | `TEST-AGENT-088`                                                                                                                                                                                     | `T-AGENT-125`                                                                                                                                                                                                                                                                               |
| `FR-AGENT-056`                                                                                                        | `DES-AGENT-071` in `ui-design.md`                                                                                                                      | `TEST-AGENT-089`                                                                                                                                                                                     | `T-AGENT-126`                                                                                                                                                                                                                                                                               |
| `FR-AGENT-057`                                                                                                        | `DES-AGENT-072` in `ui-design.md`                                                                                                                      | `TEST-AGENT-090`                                                                                                                                                                                     | `T-AGENT-127`                                                                                                                                                                                                                                                                               |
| `FR-AGENT-058`                                                                                                        | `DES-AGENT-073` in `ui-design.md`                                                                                                                      | `TEST-AGENT-091`                                                                                                                                                                                     | `T-AGENT-128`                                                                                                                                                                                                                                                                               |
| `FR-AGENT-059`                                                                                                        | `DES-AGENT-074` in `ui-design.md`                                                                                                                      | `TEST-AGENT-092`                                                                                                                                                                                     | `T-AGENT-129`                                                                                                                                                                                                                                                                               |
| `NFR-AGENT-001`, `NFR-AGENT-002`, `NFR-AGENT-003`, `NFR-AGENT-004`, `NFR-AGENT-005`, `NFR-AGENT-006`, `NFR-AGENT-007` | `DES-AGENT-005`, `DES-AGENT-008`, `DES-AGENT-009`, `DES-AGENT-014`, `DES-AGENT-015`, `DES-AGENT-060` in `ui-resilience-designs.md`                     | `TEST-AGENT-004`, `TEST-AGENT-007`, `TEST-AGENT-009`, `TEST-AGENT-011`, `TEST-AGENT-012`, `TEST-AGENT-015`, `TEST-AGENT-016`, `TEST-AGENT-017`, `TEST-AGENT-018`, `TEST-AGENT-047`, `TEST-AGENT-048` | `T-AGENT-025`, `T-AGENT-035`, `T-AGENT-036`, `T-AGENT-037`, `T-AGENT-038`, `T-AGENT-039`, `T-AGENT-082`, `T-AGENT-083`, `T-AGENT-115`                                                                                                                                                       |
| `NFR-AGENT-004`, `NFR-AGENT-006`                                                                                      | `DES-AGENT-057` in `ui-resilience-designs.md`                                                                                                          | `TEST-AGENT-076`                                                                                                                                                                                     | `T-AGENT-025`, `T-AGENT-112`                                                                                                                                                                                                                                                                |
| `NFR-AGENT-004`, `NFR-AGENT-006`                                                                                      | `DES-AGENT-058` in `ui-resilience-designs.md`                                                                                                          | `TEST-AGENT-077`                                                                                                                                                                                     | `T-AGENT-025`, `T-AGENT-113`                                                                                                                                                                                                                                                                |

`T-AGENT-081` is the program-level delivery gate for the in-scope rows above.
It introduces no parallel requirement or design source and cannot substitute
for any row-level task or test. It closes only after every remaining in-scope
task has either passed its linked verification or converged to an
evidence-backed `unsupported` capability declaration.

## `DES-AGENT-032`: Machine-Readable Capability Inventory

The canonical platform registry remains the only source of path, asset, launch,
and built-in identity facts. A shared capability projection derives those facts
and combines them with an explicit deep-adapter declaration for every built-in
platform.

- Each capability is one of `supported`, `partial`, `planned`, or
  `unsupported`, and every declaration carries a non-empty evidence code.
- Deep adapters (`providerModel`, `sessions`, `usage`, and `appearance`) are
  declared explicitly for all 31 built-ins so an omitted platform fails a test.
- Path-owned capabilities are derived from `SKILL_PLATFORMS`; the inventory
  must not duplicate path strings or infer a working protocol from a filename.
- Custom Agents derive only registry-backed path capabilities. They inherit no
  deep protocol support from a built-in platform with a similar directory.
- Renderer capability summaries are projections of this inventory, not a
  second set of hard-coded platform id allowlists.

## `DES-AGENT-019`: Overview Navigation Hub And Claude Quota Adapter

Batch confirmed on 2026-07-20; implements `FR-AGENT-022` and `FR-AGENT-023`.

### Overview data sources (no new owning state)

- Skills/MCP/Rules/Plugins counts reuse the existing domain stores via `use-agent-asset-domain.ts` (skill scan cache, MCP target status, rules files, plugin target matrix).
- Sessions total comes from `agent:sessions:list`; provider/model summary from `agent:modelConfig:get`; appearance state from `agent:appearance:get`; usage from the new `agent:usage:get`.
- The Overview tab receives an `onNavigate(tab)` callback from `AgentsWorkspace`; there is no second navigation state store. Cells whose capability is `planned`/`unsupported` render disabled and never invoke IPC.
- The flat paths panel is collapsed into a secondary region inside the Paths & capabilities card; raw paths remain visible in each tab header.

### Quota adapter contract

- Shared types in `packages/shared/types/agent.ts`: `AgentUsageWindow { utilization, resetsAt }`, `AgentUsageQuota { agentId, adapter, status, source: "provider", fiveHour, sevenDay, sevenDayOpus, plan, fetchedAt, errorCode? }`; status is one of `ok | no-credentials | expired | unavailable`.
- IPC channel `agent:usage:get` in `packages/shared/constants/ipc-channels.ts`; preload exposes `agent.getUsage(agentId)`.
- Credential resolution (main process only, via `native-command` runner and bounded file reads): macOS Keychain service `Claude Code-credentials`, then hashed variant `Claude Code-credentials-<sha256(expandedRoot).slice(0,8)>`, then `<root>/.credentials.json` honoring the configured root override; token is read from `claudeAiOauth.accessToken`; a present `expiresAt` short-circuits to `expired` before any network call.
- Query: `GET https://api.anthropic.com/api/oauth/usage` with `Authorization: Bearer <token>` and `anthropic-beta: oauth-2025-04-20`, 10s timeout; response `five_hour` / `seven_day` / `seven_day_opus` (`utilization`, `resets_at`) mapped to the contract; 401 maps to `expired`; other failures map to `unavailable` with categorized `errorCode`.
- In-memory result cache per agent for 60s; the cache never stores the token. Manual refresh bypasses the cache. No background polling in this phase.
- Capability flip: `buildCapabilities` marks `usage` as `supported` for `claude` only; every other platform stays `planned`.

### UI composition

- New `AgentOverviewPanel.tsx` owns the overview content so `AgentsWorkspace.tsx` stays within file-size policy; styling uses neutral design tokens only (`bg-card`, `bg-muted`, `border-border`, `text-muted-foreground`, `border-primary` for selection).
- New `AgentUsagePanel.tsx` renders the five-hour and seven-day windows with utilization bars, reset countdowns, a provider-reported label, a refresh action, and guided states for `no-credentials` / `expired` / `unavailable`. The overview usage cell summarizes both windows and navigates to the tab.
- All copy goes through i18n across the seven locales.

## `DES-AGENT-020`: Codex Third-Party Providers With Managed Keys

Batch confirmed on 2026-07-20; implements `FR-AGENT-024`.

### Source of truth and custody split

The 2026-07-20 implementation used `config.toml` as the management source of
truth. That transitional boundary is superseded by the user-confirmed unified
Profile migration on 2026-07-28:

- SQLite `agent_provider_profiles` and
  `agent_provider_model_mappings` are PromptHub's management source of truth.
  `config.toml` is the Codex runtime projection and may also contain
  externally-owned entries that PromptHub must reconcile rather than silently
  adopt.
- API keys have two representations only when Codex runtime requires it:
  encrypted custody under `agent-provider:<profileId>` and a verified native
  projection (`experimental_bearer_token`). Entries using `env_key` keep the
  credential external and store no secret.
- The legacy `codex-provider:<providerId>` namespace is migration input, not a
  second durable source. It remains untouched until explicit user consent and
  is removed only after the selected migration batch verifies completely.
- Declining migration preserves legacy behavior and data. It does not create a
  Profile, copy or delete a credential, or rewrite `config.toml`.

### CC Switch source reference and migration

CC Switch stable `v3.18.0`
(`606e7bbe75db7f8285f7a3be006fac22b5d22796`, MIT) is pinned at the sibling
checkout `/Users/lingxiaotian/Programs/public/cc-switch`. Its SQLite Provider
library, explicit import, live projection, atomic Codex writes and rollback
orchestration are the reference workflow. PromptHub adapts those boundaries to
the existing TypeScript/Electron architecture and does not copy CC Switch's
plaintext credential-in-`settings_config` storage.

Migration is main-process orchestration:

1. Parse the current Codex Provider entries and discover legacy managed,
   external environment and native-inline credential states.
2. Return a bounded public preview containing only provider identity,
   endpoint/protocol/model metadata, active state and credential readiness.
3. Require an explicit request containing selected provider ids and the
   preview digest. A stale digest cancels migration.
4. Create Profile records and model mappings, copy selected credential
   material directly between main-process secret boundaries, and verify the
   new public readiness state.
5. After every selected Provider succeeds, remove legacy secret refs. If any
   create, copy, verify or cleanup step fails, restore cleared legacy refs and
   remove all Profile records and new refs created by that request.
6. Leave `config.toml` byte-identical. Activation is a separate reviewed
   operation and owns backup, atomic write, re-read verification and rollback.

The algorithm is linear in selected Provider count and performs one bounded
native-config parse, one batched legacy-secret read and at most one Profile
transaction plus two secret-store writes per selected Provider. Migration
concurrency is serialized per platform; no unbounded request or retry loop is
introduced.

### Secret store

- `agent-secret-store.ts` remains the main-only encrypted boundary. New Profile
  ownership uses `agent-provider:<profileId>`. The old
  `codex-provider:<providerId>` namespace is read only by the migration
  orchestrator and is never returned across IPC. Unavailable encryption fails
  closed with a categorized error.

### Provider service and write pipeline

- `agent-codex-provider-adapter.ts` is the only Codex activation writer used by
  the unified Profile service. It implements
  `inspect/import/plan/apply/verify/rollback`, requires an explicit Provider id
  and one primary model mapping, validates protocol and endpoint policy, and
  preserves unrelated TOML keys, tables and comments.
- Activation resolves `agent-provider:<profileId>` only in main memory,
  creates a safeStorage-encrypted device-local backup, checks the preview
  digest, writes `config.toml` atomically with mode `0600`, re-reads semantic
  state and rolls back on any write or verification failure. It does not edit
  `auth.json`.
- `agent-codex-provider-service.ts` remains main-only migration input for
  inspecting legacy native entries and credentials. Its legacy list/upsert/
  remove/set-default/test IPC and preload surface has been removed; it is not a
  second management API.
- `agent-codex-provider-adapter.ts` exposes isolated connection inventory and
  explicit streaming model tests through the unified activation service. Both
  use main-process credentials, the same validated target boundary, bounded
  resources and stable redacted results; activation still makes no implicit
  network request.

### Contract

- Shared Provider Profile, model-mapping, migration-preview and activation
  contracts in `packages/shared/types/agent.ts` contain public metadata and
  readiness only. They never contain secret material or a secret-store
  reference.
- Renderer operations use the unified Profile CRUD, migration and
  import/preview/activate IPC channels. Main validates every request and emits
  stable `AGENT_PROVIDER_*` failures without native paths or credentials.
- Renderer credential input is write-only. Edit preserves the existing
  credential unless the user explicitly replaces or clears it; the current
  value is never prefilled or returned.

### UI

- The unified `AgentProviderProfileWorkbench` is the final Codex Provider
  surface. Before the first migration it shows a non-blocking migration review
  entry; the review lists each legacy Provider and credential source, selects
  nothing silently, and provides explicit migrate / not-now actions.
- The legacy `AgentProviderModelPanel.tsx` and
  `AgentCodexProviderFormDialog.tsx` renderer surfaces were removed after
  migration, full activation, encrypted rollback, unit regression and Electron
  consent/activation E2E gates passed. There is one renderer management source
  for Codex Providers.
- Migration review, failure/retry state and the unified workbench use neutral
  design tokens, keyboard/reader semantics and all seven locales.

## `DES-AGENT-021`: Desktop-Native Workspace Layout

Batch confirmed on 2026-07-20; implements `FR-AGENT-025`.

### Shell rules (all tabs)

- `AgentWorkspacePanel` drops the page canvas (`px-6/py-7/sm:px-8` outer margins and `max-w-6xl` centering are removed); every tab root becomes `flex h-full min-h-0 flex-col` and touches the workspace dividers.
- Each tab owns a compact toolbar row (`border-b border-border`, title + counts + primary actions) that never scrolls; the content region below it is the only scroll container (`flex-1 min-h-0 overflow-y-auto`).
- Primary surfaces are flat panes separated by hairline borders; rounded shadow cards remain only for genuine summary groups inside the Overview dashboard.
- Neutral design tokens only; semantic status colors unchanged.

### Direct domain tabs

- Tabs: Overview, Skills, MCP, Rules, Plugins, Provider & Model, Appearance, Config Files, Sessions. Metadata lives in `agent-workspace-tabs.ts`.
- Skills, MCP, Rules, and Plugins are direct top-level destinations rendered by `AgentAssetsWorkspace.tsx`; no generic Assets tab, segmented control, or secondary navigation is present. Each domain remains capability/path gated.
- Overview asset cells navigate directly to the owning domain tab. The header does not duplicate asset-domain actions.
- Maintenance tab removed; refresh and open-settings actions move into the workspace header overflow (`...`) menu.

### Per-tab composition

- Provider & Model: master-detail. Left list = built-in OpenAI subscription entry + third-party providers + add action; right detail = selected provider's config, model selection, key state, test, set-default/restore, edit/delete for third-party entries. Other agents get the same shell with only the built-in entry.
- Config Files: toolbar (file count + open folder) with the editor filling the remaining height edge-to-edge.
- Appearance: toolbar (import theme/pet + refresh), native status compressed into a single row, theme/pet grids filling the width.
- Usage: the 5h / 7d / Opus window cards render side by side in one row instead of stacking vertically.
- Sessions: keeps its existing two-pane layout, re-based onto the edge-to-edge shell.
- Overview: dashboard content keeps internal section padding (that is content spacing, not a page margin); status strip and grid touch the pane edges.

## `DES-AGENT-022`: Codex Quota Adapter And Provider-Aware Overview

Batch confirmed on 2026-07-21; implements `FR-AGENT-026`.

### Codex quota path

- `agent-usage-service.ts` gains a Codex adapter alongside the Claude one, selected by agent id through the same registry guard.
- Credential: parse `<root>/auth.json` (`tokens.access_token`, `tokens.account_id`); missing file/tokens -> `no-credentials`; no keychain variant exists for Codex.
- Query: `GET https://chatgpt.com/backend-api/wham/usage` with `Authorization: Bearer` and optional `ChatGPT-Account-Id`, 10s timeout; 401/403 -> `expired`; other failures categorized as before. Token isolation rules identical to the Claude adapter (main-process only, 60s result cache, no persistence/logs/refresh).
- Window mapping: `rate_limit.primary_window` and `secondary_window` are classified by `limit_window_seconds` (<= 86400 -> `fiveHour`, otherwise -> `sevenDay`); `reset_at` (epoch seconds) -> `resetsAt` ms; `plan_type` -> `plan`; `sevenDayOpus` stays null for Codex.

### Provider-aware behavior

- Before querying, the adapter resolves the active `model_provider` from `config.toml`; anything other than `openai`/unset returns `status: "unavailable"` with `errorCode: "custom-provider-active"` without a network call.
- Claude has the same short-circuit (added 2026-07-21): when `settings.json` sets `env.ANTHROPIC_BASE_URL` or a cloud-provider flag (`CLAUDE_CODE_USE_BEDROCK`/`VERTEX`/`FOUNDRY`), the official Anthropic quota endpoint is not queried and the adapter returns `custom-provider-active`; the Overview Provider & Model cell then shows the sanitized gateway endpoint and model instead of the official model summary.

## `DES-AGENT-023`: Polymorphic Multi-Agent Quota

Batch confirmed on 2026-07-21; implements `FR-AGENT-027`.

### Contract

- `AgentUsageQuota` replaces `fiveHour`/`sevenDay`/`sevenDayOpus` with `metrics: AgentUsageMetric[]`. A metric is `{ id, label, kind: "window" | "quota", utilization, resetsAt, usedAmount?, totalAmount?, unit? }`; amounts are present only for `quota` kind. All existing status/errorCode semantics stay.
- Metric id registry for i18n: `fiveHour`, `sevenDay`, `sevenDayOpus` (Claude/Codex), `weekly`, `rolling` (Kimi), `premium`, `chat` (Copilot), and `promptCredits` (Antigravity); any other id (e.g. Antigravity/Gemini model quotas) renders its provider label.

### Adapters

- Claude/Codex adapters keep their query logic and re-map results into `metrics` (ids above).
- Kimi: read `~/.kimi-code/credentials/kimi-code.json` (fallback `~/.kimi-code/oauth/kimi-code*`) for `access_token`/`expires_at`; `GET https://api.kimi.com/coding/v1/usages`. Map `usage` -> `weekly` (limit/used/resetTime), `limits[]` entries -> `rolling` with duration-derived label, `membership.level` -> plan. Verified live 2026-07-21.
- Antigravity: first discover the running Antigravity `language_server` process with bounded `ps` output, require both an Antigravity process marker and a valid CSRF argument, enumerate only loopback listening ports, and use fixed allowlisted RPC paths with a 4s timeout and 1 MiB response limit. `GetUserStatus` supplies the plan and monthly prompt-credit total; `RetrieveUserQuotaSummary` supplies grouped weekly and five-hour buckets for Gemini models and third-party Claude/GPT models. Group buckets map to `window` metrics, while monthly credits remain the only total `quota` metric. The CSRF value never leaves main-process memory or enters logs/errors. If no trusted desktop process exists on macOS, PromptHub may start the native `language_server` only from the verified `/Applications/Antigravity.app` or `~/Applications/Antigravity.app` resource path, with fixed arguments, telemetry and the built-in Chrome DevTools MCP disabled, a reserved loopback port, a random in-memory CSRF token, bounded startup/output/request limits, and no shell. The helper's IDE version is read through bounded `plutil` access to the verified app's `Info.plist`, with a sanitized compatibility fallback; PromptHub binds and waits for the explicitly announced HTTP listener rather than sending JSON RPC to the HTTPS gRPC port. Startup-only connection, timeout, and HTTP readiness failures retry with a bounded delay and overall deadline. The helper is terminated after every success or failure and escalates from `SIGTERM` to `SIGKILL` when necessary. The quota-summary request runs first so grouped quota remains available even when the optional account-status request fails. macOS Keychain (`service=gemini`, `account=antigravity`), legacy Antigravity CLI token, and shared Gemini credential reads remain compatibility fallbacks when the helper is absent or unavailable. PromptHub does not copy Antigravity OAuth client credentials or refresh its tokens itself; `antigravity-not-running` remains only a recovery state when neither a running service nor the bounded helper can provide current quota.
- Gemini CLI: read `~/.gemini/oauth_creds.json` (`expiry_date` ms); POST `loadCodeAssist` then `retrieveUserQuota`; buckets -> `quota` metrics by `modelId`, tier -> plan.
- Copilot: resolve a GitHub OAuth token from `~/.config/gh/hosts.yml` then `~/.config/github-copilot/hosts.json`; `GET https://api.github.com/copilot_internal/user` with `Authorization: token`; map `quota_snapshots.premium_interactions`/`chat` (entitlement/remaining/percent_used) -> `premium`/`chat` quota metrics, `quota_reset_date` -> resetsAt, `copilot_plan` -> plan.
- Cursor stays `planned` (no public quota API; documented exclusion).

### UI

- The banner iterates `metrics`: reset windows render as ring gauges; only quota metrics with numeric `usedAmount` and `totalAmount` render as progress bars. Antigravity group ids combine the provider group label with localized weekly/five-hour labels. The layout remains bounded to five visible metrics, which fits four Antigravity window rings plus its monthly credit total.

### Native application launch

- `SkillPlatform.launchPaths` owns an operating-system-specific allowlist of desktop application paths. Renderer state exposes only a `launchable` capability bit.
- `agent:launch` accepts an Agent id, resolves its platform in main, checks only the declared candidates, and uses Electron `shell.openPath` so an existing app is focused instead of duplicated. Renderer-provided paths and shell command strings are never accepted.
- `buildCapabilities` marks `usage` supported for `claude`, `codex`, `kimi`, `antigravity`, `gemini`, `copilot`.

## `DES-AGENT-024`: Skill Asset Cards In The Agent Workspace

Batch confirmed on 2026-07-21; implements `FR-AGENT-028`.

### Composition (renderer-only, no new main-process surface)

- The Skills domain of `AgentAssetsWorkspace` renders `AgentSkillAssetPanel`: toolbar (search, managed/unmanaged/symlink/copy filter chips, refresh, "Install My Skill") plus a responsive card grid; other domains keep compact rows.
- Rows reuse `agentScanState[agent.id]` from the skill store and `getSkillScanStatus` for badge semantics — the same source of truth as `SkillAgentsView`; `AgentAssetItem` is not extended; the panel consumes `AgentScannedSkill` directly via a dedicated hook.
- Actions map one-to-one to existing flows: open folder (`window.electron.openPath`), adopt (`useSkillStore.importScannedSkills` with the `handleImportAgentSkill` hydration pattern), open managed skill (jump to the Skills module my-skills view), install from library (`SkillLibraryImportModal` with the agent's skills dir as fixed target), uninstall (`skillApi.uninstallPlatformSkill` + `ConfirmDialog`, built-in blocked).
- Card click opens `SkillFullDetailPage` with `overrideSkill` + `agentContext` + `agentActions` (the `buildProjectDetailSkill` adapter), replacing the right pane with a back action — the same drill-in contract as the Skills module, embedded in the workspace shell.
- Usage UI renders a dedicated custom-provider state for that code. `buildCapabilities` marks `usage` supported for `codex` as well as `claude`.
- Overview Provider & Model cell: built-in active -> current model + credential state; third-party active -> sanitized base URL + model from `listProviders`/`getModelConfig`.
- Overview "Paths & capabilities": the capability grid is removed; the collapsible paths list remains and each row gets an open-folder action via `window.electron.openPath`.

### Usage banner revision (2026-07-21)

- The standalone Usage tab is removed (tab bar 7 -> 6); usage is not a functional page but dashboard data.
- The Overview renders a usage banner above the navigation grid when the usage capability is supported/partial: SVG ring gauges per window (`fiveHour`/`sevenDay`/`sevenDayOpus` when present) with centered utilization percentage, window label, reset countdown, plan badge, provider-reported label, and a refresh action. Rings use neutral track with threshold-toned strokes (<70% primary, 70-90% amber, >=90% destructive); single-window responses render gracefully without empty placeholders.
- Guided states reuse the existing mappings (no-credentials / expired / unavailable / `custom-provider-active`) in compact banner form.
- `AgentUsagePanel.tsx` is repurposed into the overview banner component; the usage navigation cell is removed from the grid.

## `DES-AGENT-031`: Codex / ChatGPT Presentation Identity

Batch confirmed on 2026-07-21; implements `FR-AGENT-035`.

- `codex` remains the stable platform id and `~/.codex` remains the native data root. Name and icon preferences are renderer presentation settings and do not alter platform detection, filesystem paths, IPC, provider ids, sessions, assets, or appearance adapters.
- The default registry name becomes `Codex`. A normalized `agentIdentityPreferences.codex` setting independently stores an allowlisted name choice (`codex | chatgpt`) and icon choice (`codex | chatgpt`). Missing values default to Codex; malformed values are rejected field by field.
- A pure identity projection resolves the display name and icon id before managed Agents are sorted, searched, or rendered. `ManagedAgentSummary` carries the resolved icon id so list and detail surfaces use the same identity source.
- `PlatformIcon` owns both bundled icon choices. The ChatGPT choice packages the complete 1024 px Aqua and Dark Aqua Blossom assets extracted at development time from the locally installed ChatGPT app asset catalog; app-controlled theme classes select the matching file without a runtime dependency on `/Applications/ChatGPT.app`. Settings may select only bundled ids; arbitrary paths, data URLs, and remote URLs are not accepted.
- `CodexIdentityFields` is embedded only in the built-in Codex row's existing edit panel, beside the root and asset-path fields. It is not a standalone settings section. Name and icon changes share the Agent editor's draft, Save, Cancel, and Reset lifecycle; Save refreshes the managed Agent projection without restarting the application.
- Each name and icon choice is an `aria-pressed` segmented control. The active choice uses a solid primary surface, primary border, contrasting text, and an explicit check mark so selection does not depend on a subtle shadow or color nuance.
- The preference is part of the persisted settings state and therefore follows the existing non-sensitive settings snapshot, backup, restore, and sync contract.

## `DES-AGENT-025`: Qwen Code Platform Boundary

This design implements `FR-AGENT-029`. Qwen Code uses stable platform id
`qwen` and display name `Qwen Code`. It is not an alias for `qoder`; both
entries may coexist because they identify different installed products and
different local data contracts.

### Root and scope resolution

1. A PromptHub user override wins.
2. A non-empty `QWEN_HOME` resolves the user configuration root. Relative values
   are resolved using Qwen Code's documented current-working-directory rule;
   PromptHub stores and returns the normalized absolute path.
3. Otherwise the user root is `~/.qwen` on macOS/Linux and the equivalent home
   expansion on Windows.
4. `QWEN_RUNTIME_DIR` resolves conversations, logs, and todos only. It never
   replaces the user configuration root or a project `.qwen/` directory.
5. Project assets are resolved from the selected repository, never by joining
   them under the user root.

### Capability and ownership matrix

| Domain         | User scope                                                                      | Project scope                                     | PromptHub policy                                                                                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Skills         | `<QWEN_HOME>/skills/<name>/` and compatibility discovery in `~/.agents/skills/` | `.qwen/skills/<name>/`                            | Manage the complete package, including `SKILL.md`, scripts, templates, and resources. Write to the native `.qwen/skills` target; treat `.agents/skills` as compatibility discovery unless the user selects it explicitly. |
| SubAgents      | `<QWEN_HOME>/agents/*.md`                                                       | `.qwen/agents/*.md`                               | Model as Agent assets with YAML-frontmatter validation; do not confuse these definitions with the Qwen Code platform itself.                                                                                              |
| MCP            | `<QWEN_HOME>/settings.json` `mcpServers`                                        | `.qwen/settings.json` `mcpServers`                | Prefer the native `qwen mcp` command when it can express the requested operation; otherwise perform a structured JSON merge that preserves unrelated settings and supports backup/verify/rollback.                        |
| Rules          | `<QWEN_HOME>/QWEN.md`                                                           | repository `QWEN.md`; local `.qwen/QWEN.local.md` | Expose the three documented scopes and their precedence. Never fold auto-memory into Rules.                                                                                                                               |
| Extensions     | `<QWEN_HOME>/extensions/<name>/qwen-extension.json`                             | `.qwen/extensions/<name>/qwen-extension.json`     | Use native extension lifecycle commands. Extension-provided Skills, SubAgents, MCP, and commands are derived/read-only children of the parent bundle.                                                                     |
| Commands       | `<QWEN_HOME>/commands/*.md`                                                     | `.qwen/commands/*.md`                             | Discovery-first. A later Commands domain may manage them; they are not Skills or Plugins by inference.                                                                                                                    |
| Provider/model | `<QWEN_HOME>/settings.json`                                                     | `.qwen/settings.json`                             | Inspect redacted model/provider identity. Secret-bearing provider or `env` fields remain main-process only until a Qwen-specific secret write contract passes.                                                            |
| Sessions       | runtime root `projects/<sanitized-project>/chats/`                              | native CLI project selection                      | Prefer `qwen sessions list --json`; page and parse bounded native results rather than recursively scanning the runtime root.                                                                                              |

Qwen Code applies settings in layers: defaults, system defaults, user, project,
system overrides, environment variables, and CLI flags. PromptHub may edit only
the explicit user/project layer chosen by the user and must not imply that a
lower-precedence value is active when a higher-precedence layer overrides it.

### Secret and runtime exclusions

- Exclude `mcp-oauth-tokens.json`, `mcp-oauth-tokens-v2.json`, credentials,
  provider API keys, expanded `env` values, MCP headers/environment values,
  OAuth client secrets, and authentication caches from renderer payloads,
  diagnostics, normal backup, export, and sync.
- Exclude sessions, runtime sidecars, logs, todos, auto-memory under
  `projects/<project>/memory/`, and `.qwen/team-memory/` from normal backup and
  sync. Team memory is opt-in shared project state owned by Qwen Code, not a
  PromptHub Rule or Skill.
- A settings write is `read -> parse -> normalize requested subtree -> preview
-> backup -> digest check -> atomic replace -> re-read -> semantic verify ->
rollback on failure`. Complexity is linear in the settings file size and uses
  one bounded read plus one staged write; no recursive asset scan is required.
- Session listing delegates to the native CLI with a timeout and output byte
  cap. PromptHub retains only the requested bounded metadata page and never
  loads every transcript into memory.

### Implementation gate

Each Qwen capability may move from planned to supported only after its matching
`TEST-AGENT-036` fixtures cover the relevant environment overrides, scope,
package ownership, secret redaction, bounded failure paths, rollback, and
backup/sync exclusions. The overall task remains incomplete until project
SubAgent parsing, Commands discovery, and Electron E2E also pass; those missing
surfaces do not roll back already verified registry, Skill, MCP, Rules, model,
extension, or read-only session adapters.
An official Qwen/Qwen Code mark with recorded provenance is required; a generic
letter fallback may be used only as the runtime fallback, not as the bundled
brand asset.

## `DES-AGENT-026`: Common-Agent Session Adapter Breadth

This design implements `FR-AGENT-030` without creating a second session store.
Agent-owned files and native indexes remain the source of truth; PromptHub keeps
no transcript copy and exposes only bounded list/read results over the existing
`agent:sessions:*` IPC contract.

- Codex: scan only `sessions/**/*.jsonl` and `archived_sessions/*.jsonl` below
  the resolved Codex root, deduplicate by `session_meta.payload.id`, derive the
  title from the first visible `event_msg.user_message`, and render only visible
  user/assistant event messages. Resume is `codex resume <id>`.
- Grok Build: scan only `<root>/sessions/<encoded-project>/<session-id>/`, read
  bounded `summary.json` metadata and `chat_history.jsonl`, ignore lock/terminal/
  artifact files, and resume with `grok --resume <id>` in the decoded project
  directory when it is absolute.
- OpenClaw: read the bounded legacy per-agent `sessions/sessions.json` index and
  its referenced JSONL transcript only when both resolve beneath the configured
  OpenClaw root. Newer native/SQLite stores remain a later native-CLI adapter;
  the legacy reader is read-only and never runs cleanup/compact/delete.
- Qwen Code: use bounded `qwen sessions list --json --limit N` output and accept
  a transcript path only when its real path remains below `QWEN_RUNTIME_DIR`.

All adapters cap discovered files, metadata bytes, transcript bytes, entry text,
and native command output. Listing is `O(n log n)` for at most the configured
scan cap; selected transcript reads are `O(min(fileSize, 2 MiB))`. No adapter
follows directory symlinks, writes Agent state, or includes transcript bodies in
backup, sync, export, logs, or default overview payloads.

## `DES-AGENT-028`: Paged Session Metadata And Progressive Transcript Rendering

The existing `agent:sessions:list` contract gains a validated `offset` while
retaining a bounded `limit`. Renderer pages contain 50 metadata records. Native
CLI adapters request at most `offset + limit` rows only when the upstream CLI
does not provide a cursor, then slice locally; filesystem adapters scan only
their allowlisted indexes and hydrate metadata for the requested window. The
maximum offset remains capped by the existing 2,000-file discovery ceiling.

The renderer appends pages by stable session id, exposes the native total and a
Load More action, and applies `content-visibility: auto` to off-screen session
rows. A selected transcript remains an on-demand read capped at 2 MiB and 64 KiB
per entry. Only the first 80 entries are mounted initially; later batches are
added explicitly, and the existing truncation notice remains visible when the
source exceeded the byte cap. This keeps list memory `O(loaded metadata)` and
mounted transcript work `O(visible batch)` rather than `O(all native history)`.

OpenCode remains native-CLI owned: an empty successful `opencode session list
--format json` response is an empty history, not an adapter failure. PromptHub
does not query plugin sidecars as substitutes for missing session rows.

## `DES-AGENT-027`: In-Workspace Agent Settings Dialog

This design implements `FR-AGENT-031` without creating a second settings
workflow. `AgentsWorkspace` owns only the modal open state. The dialog reads
effective built-in configuration from the platform registry, existing
`builtinAgentOverrides`, and the current managed Agent path; custom Agent drafts
come from `customAgents`.

`AgentSettingsDialog` reuses `BuiltinAgentEditor`, including the Codex/ChatGPT
identity controls, and persists with `updateBuiltinAgentOverride`,
`setCodexIdentityPreference`, or `updateCustomAgent`. Those existing actions
remain responsible for normalization, validation, main-process synchronization,
and managed-Agent refresh. The dialog therefore owns no durable state and does
not duplicate filesystem or settings logic.

Opening, editing, resetting, saving, validation failure, and closing are bounded
UI operations over one Agent draft, with `O(f)` time and memory where `f` is the
small fixed number of editable path fields. Changing the selected Agent closes
the modal so a stale draft cannot be applied to a different target.

## `DES-AGENT-029`: Oh My Pi Native Boundary

This design implements `FR-AGENT-033` for issue #187. Oh My Pi is represented
by the stable platform id `oh-my-pi` and the display name `Oh My Pi`; no
presentation alias with a `CLI` suffix is introduced.

### Roots and assets

- The default user root is `~/.omp/agent`. `PI_CODING_AGENT_DIR` is resolved
  through the existing platform-root service and wins when it is an absolute
  path; PromptHub settings overrides remain higher priority through the same
  service.
- User Skills live at `<root>/skills`, global Rules at `<root>/RULES.md`, and
  user MCP at `<root>/mcp.json`. A project target is `<project>/.omp/mcp.json`.
- Oh My Pi plugins are installed by the native runtime below the sibling
  `<root>/../plugins` directory (normally `~/.omp/plugins`). PromptHub exposes
  this as a derived path only; it does not scan or install package contents as
  PromptHub-owned Plugin records in this batch.
- Config Files uses an allowlist of `config.yml`, `config.yaml`,
  `settings.json`, `mcp.json`, `.mcp.json`, and `RULES.md`. Credentials,
  session files, caches, and arbitrary profile files are not promoted into the
  editor.

### Sessions

The read-only adapter scans only direct project directories one level below
`<root>/sessions` and accepts JSONL files whose first session record contains a
safe id. It reads at most 16 KiB for header discovery, 256 KiB for metadata,
2 MiB for a selected transcript, and 64 KiB per visible entry through the
shared session utility bounds. Metadata is deduplicated by id and sorted by
file mtime; malformed lines are isolated. `toolResult` records are rendered as
tool entries, while system/developer messages are not presented as user or
assistant conversation. Symlinks and unsafe ids are rejected before detail
reads. The resume payload is `{ executable: "omp", args: ["--resume", id] }`
with the parsed project cwd when available; PromptHub never launches it from
the session adapter.

The adapter intentionally excludes nested subagent transcripts. Native
profile/config-directory overrides beyond `PI_CODING_AGENT_DIR` (for example
XDG or named profiles), provider activation, credential editing, usage/quota,
and package installation require a later contract-specific change rather than
guessed filesystem behavior. The non-secret model projection is defined by
`DES-AGENT-030` below.

## `DES-AGENT-030`: Oh My Pi YAML Model Projection

This design implements `FR-AGENT-034` without creating a second provider store
or copying Oh My Pi credentials into PromptHub. The adapter uses the resolved
Oh My Pi root and two native files:

- `config.yml` is preferred, with `config.yaml` as a compatibility fallback;
  only `modelRoles.default` is read or written for the global model selection.
- `models.yml` is optional and supplies provider ids, explicit model ids and
  provider-level `baseUrl`/`auth` metadata. Its `apiKey`, headers, OAuth data,
  model metadata and unknown fields are never returned to the renderer.

The read path is bounded by the existing 2 MiB config limit and parses YAML
with the repository's existing `yaml` dependency. The normalized result uses
the existing `AgentModelConfiguration` contract and reports the adapter as
`oh-my-pi-yaml-v1`; available models are concrete `provider/model` selectors,
with the selected model retained even when it is not listed in the static
catalog. A provider endpoint is passed through the existing URL sanitizer.
Credential status is presence-only: `apiKey` configured, `auth: oauth`, and
keyless `auth: none` never reveal the credential value or environment lookup.

Writes parse the selected YAML document, set only `modelRoles.default`, create
the existing per-agent backup, guard against a concurrent source change, write
through the existing atomic path, re-read and verify the selector, and restore
the exact original bytes on any failure. Provider switching, credential writes,
quota requests, runtime discovery and plugin installation remain outside this
adapter.

The contract was re-audited against upstream revision
`cc00ab161b2721e50d8a96a0dc9552abfd258b8b`. Current Oh My Pi owns stored API
keys, OAuth accounts, multi-account rotation, and broker-backed credentials in
or behind `<root>/agent.db`; it also resolves runtime and environment sources.
PromptHub therefore keeps `providerModel` at `partial`. It may select a
documented `provider/model` value, but it must not present the generic
model-only adapter as a full Profile endpoint/credential adapter. Reading or
writing `agent.db`, copying an Oh My Pi credential into PromptHub's secret
store, or projecting a PromptHub secret into `models.yml` would change the
credential source of truth and requires a separately approved design. No
upstream source is copied or vendored.

## `DES-AGENT-033`: Kimi Code Provider And Model Projection

This design extends the existing Kimi model-only adapter under
`FR-AGENT-003` to `FR-AGENT-006` and `FR-AGENT-011`. It is based on the
official Kimi Code `config.toml` contract and the upstream
`MoonshotAI/kimi-cli` revision
`4a550effdfcb29a25a5d325bf935296cc50cd417`; no upstream source is copied or
vendored.

### Native ownership and profile shape

- The resolved Kimi root and `config.toml` remain the runtime source of truth.
  PromptHub owns Provider Profiles, model mappings, secure secret references,
  redacted snapshots, and encrypted rollback backups.
- A managed Profile stores only public metadata: native provider id and type,
  protocol, endpoint, model alias, upstream model id, and
  `max_context_size`. The API key remains in the main-process secret store and
  is projected to native plaintext only during confirmed activation because
  Kimi Code requires the credential in `config.toml`.
- Model alias is `modelMappings.primary.modelId`; upstream model id and context
  size are validated mapping parameters. Provider id is public profile config.
  No credential, OAuth reference, custom header value, or provider `env` value
  enters renderer state, snapshots, exports, logs, or ordinary backups.

### Supported protocol projection

| Kimi provider `type` | PromptHub protocol       | Credential policy                                |
| -------------------- | ------------------------ | ------------------------------------------------ |
| `kimi`               | `openai-chat`            | PromptHub-owned direct API key                   |
| `openai`             | `openai-chat`            | PromptHub-owned direct API key                   |
| `openai_responses`   | `openai-responses`       | PromptHub-owned direct API key                   |
| `anthropic`          | `anthropic-messages`     | PromptHub-owned direct API key                   |
| `google-genai`       | `google-generative-ai`   | PromptHub-owned direct API key                   |
| `vertexai`           | `platform-native`        | Google ADC remains entirely platform-owned       |
| OAuth/custom headers | `platform-native` import | Read-only; PromptHub never owns or tests secrets |

Kimi `/login` credentials, `credentials/`, provider `oauth`, provider `env`,
and `custom_headers` are external authentication surfaces. Import reports their
presence without values. Direct providers with native plaintext credentials
can be imported as incomplete Profiles, but require an explicit write-only
credential entry before reactivation.

### Apply, verification, and rollback

The adapter performs one bounded read of `config.toml`, parses it as TOML,
preserves all unknown semantic fields, and edits only the selected provider
entry, selected model entry, and `default_model`. It validates identifiers,
endpoint, model metadata, file size, regular-file status, symlink rejection,
and the pre-write digest. The prior bytes are stored only in the encrypted
Agent config backup area. The write uses the shared atomic replacement path,
optionally invokes the allowlisted native `kimi doctor config` validator,
re-reads the file, verifies provider/model/default selection semantically, and
restores the exact prior bytes on any failure.

Platform-native activation never creates a provider or model. It can only
select an already valid native model whose provider/type matches the imported
Profile. Direct connection and streaming tests dispatch to the existing
OpenAI-compatible, Anthropic, or Google Gemini main-process probes. Their
SSRF/DNS, timeout, response-size, abort, retry, and redaction policies remain
the single network boundary; the Kimi adapter adds no proxy or protocol
conversion layer.

Runtime complexity is `O(n)` time and memory in the bounded TOML size for
inspect/apply/verify. Network probes are one bounded request plus at most one
existing retry. No recursive filesystem scan or unbounded provider/model
enumeration is introduced.

## `DES-AGENT-034`: Qwen Code Provider Catalog And Credential Projection

This design extends the existing Qwen model-only projection under
`FR-AGENT-003` to `FR-AGENT-006` and `FR-AGENT-011`. Evidence is the official
Qwen Code settings, authentication, and model-provider documentation plus the
public `QwenLM/qwen-code` revision
`bfd4c8e519f96ca5bdc6cdd9f7a635b9345dbf11`. No upstream source is copied or
vendored.

### Current native contract

- User `settings.json` is the provider catalog and active-selection source of
  truth. Project `.qwen/settings.json` remains a higher-precedence
  project-owned layer and is not rewritten by a user Profile activation.
- Current `$version: 4` uses a bare `ModelConfig[]` at
  `modelProviders[providerId]`. The earlier wrapped
  `{ protocol, models }` form is invalid for this adapter because current Qwen
  silently skips it.
- A provider model is identified by provider id plus model `id` and normalized
  `baseUrl`. Built-in provider ids route directly; a custom provider id must
  have an explicit `providerProtocol` mapping.
- `security.auth.selectedType` selects the provider id and `model.name`
  selects the model. PromptHub never writes the deprecated
  `security.auth.apiKey` or `security.auth.baseUrl` fields.

### Profile and secret ownership

A direct Qwen Profile stores public provider id, protocol, endpoint, model id,
environment-key name, and non-secret Provider metadata. The credential remains
in the main-process secret store until confirmed activation. Activation writes
that value only to user `.env`, the location recommended by current Qwen
documentation, and removes the same selected key from the lower-priority
`settings.json.env` object so one credential has one active native source.
Other environment entries and all unrelated settings remain intact.

| Provider protocol | Qwen routing value | Credential policy                          |
| ----------------- | ------------------ | ------------------------------------------ |
| OpenAI-compatible | `openai`           | PromptHub-owned direct API key             |
| Anthropic         | `anthropic`        | PromptHub-owned direct API key             |
| Google GenAI      | `gemini`           | PromptHub-owned direct API key             |
| Google Vertex     | `vertex-ai`        | ADC remains platform-owned                 |
| Legacy Qwen OAuth | `qwen-oauth`       | Read-only; free tier discontinued upstream |

Custom provider ids may map only to `openai`, `anthropic`, or `gemini`.
Provider `generationConfig`, capabilities, descriptions, custom headers, and
other unknown fields are preserved when the exact model entry already exists;
PromptHub does not synthesize an advanced generation policy. Automatic Coding
Plan entries and reserved `BAILIAN_CODING_PLAN_API_KEY` ownership are imported
as platform-managed unless the user creates a distinct manual provider/env-key
Profile, matching Qwen's overwrite warning.

### Apply, verification, and rollback

The adapter performs bounded parallel reads of `settings.json` and `.env`,
rejects non-regular files, symlinks, malformed input, unsafe identifiers and
endpoints, and computes one digest over both byte streams. One encrypted bundle
contains the exact prior bytes for both files. After a pre-write digest check,
settings and environment files are atomically replaced in order; any partial
failure restores both prior files. A bounded semantic reread verifies provider
protocol, exact provider/model/endpoint identity, active selection,
environment-key name, and credential presence without exposing the value.

Direct health and streaming tests resolve the Profile secret only in main and
reuse the existing OpenAI-compatible, Anthropic, and Google Gemini probes.
Platform-owned entries return a stable unsupported result and are never tested
with borrowed credentials. Runtime complexity is `O(n)` time and memory in the
bounded settings and environment files. Provider lookup is a single bounded
linear scan of the selected provider's model array; no recursive scan,
unbounded network fan-out, proxy, protocol conversion, or OAuth pool is added.

## `DES-AGENT-035`: OpenCode Provider Catalog And Native Auth Boundary

This design extends the existing OpenCode model-only projection under
`FR-AGENT-003` to `FR-AGENT-006` and `FR-AGENT-011`. Evidence is the official
OpenCode config/provider documentation and the public `anomalyco/opencode`
revision `017a5977d2107092007623e507fc5c6eb337d3b2`. No upstream source is
copied or vendored.

### Version and path boundary

The current stable schema and installed OpenCode `1.18.3` use singular
`provider`, `model`, and `small_model` in the global
`~/.config/opencode/opencode.jsonc` or `opencode.json`. The adapter preserves
JSONC comments and chooses the same `opencode.jsonc`, `opencode.json`,
`config.json` precedence implemented upstream. The separate experimental v2
documentation uses a materially different plural `providers` contract;
PromptHub detects but does not write that shape until it becomes the stable
schema and has its own compatibility fixtures.

Credentials are owned by OpenCode's XDG data root, not its config root. The
main process resolves `${XDG_DATA_HOME}/opencode/auth.json`, with the platform
XDG default when the variable is absent. The renderer never supplies or sees
this path. Tests inject an isolated data root rather than changing process
home state.

### Supported Profile shapes

PromptHub supports only the two custom-provider packages documented for direct
OpenAI-compatible endpoints:

| Profile protocol   | OpenCode `npm` package      | Native request contract |
| ------------------ | --------------------------- | ----------------------- |
| `openai-chat`      | `@ai-sdk/openai-compatible` | Chat Completions        |
| `openai-responses` | `@ai-sdk/openai`            | Responses               |

A direct Profile stores public provider id, package/protocol, sanitized
endpoint, primary model id, optional small model id, and non-secret Provider
metadata. Activation writes or updates the exact `provider[providerId]`,
selects native model strings as `providerId/modelId`, and writes only
`{ type: "api", key }` at `auth.json[providerId]`. It removes a selected
provider's legacy inline `options.apiKey` only after an encrypted backup exists.
Existing custom authorization headers block direct activation instead of being
silently removed or combined with another credential source.

Built-in providers, unsupported npm packages, environment/file substitutions,
OAuth, well-known auth, cloud identity and pre-existing API credentials are
imported as platform-native, redacted and read-only. PromptHub may retain or
select only an already-valid native state and never borrows those credentials
for a network test.

### Apply, verification, and rollback

The adapter performs bounded parallel reads of the selected config and native
auth files, rejects non-regular files, symlinks, malformed input, unsafe ids,
model names and endpoints, and computes one digest over both byte streams. One
encrypted bundle contains the exact prior bytes and target-relative config
name. A pre-write digest check protects both files; config and auth are
atomically replaced with mode `0600`, and a partial failure restores both.
Semantic reread verifies provider/package/endpoint/model/auth type and key
presence without returning the key.

Direct connection and streaming tests resolve only the Profile secret in the
main process and reuse the existing OpenAI Chat or Responses probes. Runtime
complexity is `O(n)` time and memory in the bounded config/auth files, with
constant provider/model lookups inside their bounded maps. No recursive scan,
native database access, proxy, protocol conversion, OAuth pool, or network
fan-out is introduced.

## `DES-AGENT-036`: GitHub Copilot CLI Model And Asset Boundary

This design implements `FR-AGENT-036` from current GitHub Copilot CLI `1.0.48`
and GitHub's public CLI configuration reference. PromptHub reuses documented
contracts only; it does not copy or vendor Copilot source.

`COPILOT_HOME` overrides the default `~/.copilot` root. The registry exposes
only documented user-owned assets: `skills/`, `agents/`,
`copilot-instructions.md`, `mcp-config.json`, `settings.json`, and installed
Plugin discovery. Automatically managed `config.json`, `session-state/`,
`session-store.db`, permissions, logs, MCP OAuth/secrets, Plugin metadata, and
native authentication remain excluded from generic editing and ordinary
configuration backup.

The model adapter reads JSONC `settings.json` and projects only the top-level
`model` as a platform-native Profile mapping. It writes that field through the
existing bounded read, exact backup, digest race check, atomic replacement,
semantic reread, and rollback pipeline. Missing files may be created; malformed,
oversized, symlinked, or concurrently changed files fail closed.

Copilot BYOK is process-environment-only:
`COPILOT_PROVIDER_BASE_URL`, provider type, wire API/model, and credential
variables affect a launched process but have no documented durable settings
projection. The model-only adapter therefore blocks endpoint and secret
Profiles and keeps `providerModel` at `partial`. A future runtime-launch
environment design must be explicit and user-confirmed before PromptHub can
claim full Provider activation.

## `DES-AGENT-037`: Copilot Native Plugin Install Gate

Copilot package shape and installation are separate contracts. PromptHub keeps
the existing read-only scan of documented installed package markers, but
removes Copilot from filesystem-based distribution. The target matrix remains
the single UI and service gate: `github-copilot` is visible as an `adapter`,
disabled, and explains that native CLI registration is required.

`assertSupportedPluginTargets` rejects direct calls before target resolution or
filesystem mutation. A later implementation may enable the target only after a
bounded `copilot plugin install` adapter provides preview, explicit
confirmation, timeout/output limits, post-install verification, uninstall or
rollback, and tests against the current CLI. No platform-managed Plugin
metadata is edited directly.
