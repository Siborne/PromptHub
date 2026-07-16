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

All built-in platforms participate in Agent discovery and display from the first delivery. Deep-management work is prioritized rather than scope-filtered:

1. User-pinned Agents
2. Detected or explicitly configured Agents
3. Curated common Agents such as Claude Code, Codex CLI, Gemini CLI, OpenCode, Cursor, Windsurf, Cline and OpenClaw
4. Remaining built-in platforms
5. Enabled custom Agents, with detected/configured custom Agents promoted by the same rules

Provider, session, config and CLI adapters may have different delivery order because each depends on format stability, security and fixture evidence. The capability matrix, not platform visibility, records implementation depth.

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

Provider tests run in main/core with an abort signal, connect timeout, total timeout, bounded retries, and response-size limits.

Result fields:

- adapter/protocol/provider profile id
- tested model and endpoint origin, with sensitive query values removed
- started/finished timestamps
- DNS/connect/TLS/request/first-token/total durations when available
- success, HTTP category, protocol category, retry count
- bounded redacted response preview only when safe

Testing must not modify the active Agent configuration. The adapter builds an isolated request from the Provider Profile and secure secret reference.

## `DES-AGENT-010`: UI Information Architecture

### Global Navigation

Add `Agents` as a first-class left-rail module. Existing settings for Agent roots become advanced platform/path settings and link back to the corresponding Agent detail.

### Workspace Layout

- Left/local list: All, Installed, Configured, Needs Attention, Not Detected, custom filters.
- The All view contains the complete built-in registry plus enabled custom Agents. It is never reduced to platforms with provider/session adapters.
- Default order is pinned, detected/configured, curated common priority, then stable name order. Search and filters operate over the complete set.
- Agent row: icon, name, detection/version, current provider/model, health, asset/session summary.
- Main detail header: Agent identity, status, current provider, diagnose, quick actions.
- Tabs:
  - Overview
  - Provider & Model
  - Skills
  - MCP
  - Rules
  - Plugins
  - Config Files
  - Sessions
  - Usage
  - Maintenance

Tabs are capability-aware. Overview and supported asset/path information remain available for every Agent. Unsupported deep capabilities show `partial`, `planned`, or `unsupported` with a reason instead of hiding the Agent or presenting a broken empty page.

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

## `DES-AGENT-017`: Traceability

| Requirements                                                                                                          | Design                                      | Verification                                                                                                                                                     | Tasks                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `FR-AGENT-001`, `FR-AGENT-002`, `FR-AGENT-018`, `FR-AGENT-019`                                                        | `DES-AGENT-001` to `003`, `014`, `016`      | `TEST-AGENT-001`, `TEST-AGENT-002`, `TEST-AGENT-016`                                                                                                             | `T-AGENT-006`, `011`, `013`, `014`, `034`                                                                                             |
| `FR-AGENT-003`, `FR-AGENT-004`, `FR-AGENT-005`, `FR-AGENT-006`, `FR-AGENT-007`                                        | `DES-AGENT-004` to `006`, `012`             | `TEST-AGENT-003`, `TEST-AGENT-004`, `TEST-AGENT-005`, `TEST-AGENT-006`, `TEST-AGENT-007`, `TEST-AGENT-015`                                                       | `T-AGENT-005`, `T-AGENT-007`, `T-AGENT-012`, `T-AGENT-015`, `T-AGENT-016`, `T-AGENT-017`, `T-AGENT-018`, `T-AGENT-019`, `T-AGENT-027` |
| `FR-AGENT-008`                                                                                                        | `DES-AGENT-002`, `007`                      | `TEST-AGENT-008`, `017`                                                                                                                                          | `T-AGENT-013`, `021`                                                                                                                  |
| `FR-AGENT-009`                                                                                                        | `DES-AGENT-006`, `010`, `015`               | `TEST-AGENT-006`, `009`                                                                                                                                          | `T-AGENT-015`, `021`, `021A`                                                                                                          |
| `FR-AGENT-010`, `FR-AGENT-015`                                                                                        | `DES-AGENT-008`                             | `TEST-AGENT-010`, `011`                                                                                                                                          | `T-AGENT-016`, `022`, `028`, `030`                                                                                                    |
| `FR-AGENT-011`                                                                                                        | `DES-AGENT-009`, `015`                      | `TEST-AGENT-012`                                                                                                                                                 | `T-AGENT-017`, `018`, `019`, `021`                                                                                                    |
| `FR-AGENT-012`                                                                                                        | `DES-AGENT-011`                             | `TEST-AGENT-013`                                                                                                                                                 | `T-AGENT-024`                                                                                                                         |
| `FR-AGENT-013`, `FR-AGENT-016`                                                                                        | `DES-AGENT-012`                             | `TEST-AGENT-014`, `015`                                                                                                                                          | `T-AGENT-023`, `031`                                                                                                                  |
| `FR-AGENT-014`                                                                                                        | `DES-AGENT-003`, `010`, `014`               | `TEST-AGENT-016`                                                                                                                                                 | `T-AGENT-029`                                                                                                                         |
| `FR-AGENT-017`                                                                                                        | `DES-AGENT-013`, `016`                      | separate change                                                                                                                                                  | `T-AGENT-032`, `033`                                                                                                                  |
| `NFR-AGENT-001`, `NFR-AGENT-002`, `NFR-AGENT-003`, `NFR-AGENT-004`, `NFR-AGENT-005`, `NFR-AGENT-006`, `NFR-AGENT-007` | `DES-AGENT-005`, `008`, `009`, `014`, `015` | `TEST-AGENT-004`, `TEST-AGENT-007`, `TEST-AGENT-009`, `TEST-AGENT-011`, `TEST-AGENT-012`, `TEST-AGENT-015`, `TEST-AGENT-016`, `TEST-AGENT-017`, `TEST-AGENT-018` | `T-AGENT-005`, `T-AGENT-015`, `T-AGENT-016`, `T-AGENT-025`, `T-AGENT-035`                                                             |
