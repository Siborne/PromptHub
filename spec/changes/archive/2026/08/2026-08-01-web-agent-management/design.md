# Design

<!-- traceability: enforced -->

## Resolved Conflict

Stable Web behavior currently says local Agent scans, platform detection, and installation are Desktop-only. `ui.store.ts` also normalizes a persisted Web `agents` module back to Prompt, and the Web bridge exposes no `window.api.agent` contract. The Desktop workbench invokes more than forty native Agent operations spanning configuration, Provider Profiles, sessions, conversations, CLI maintenance, appearance, and process launch.

The user approved synchronization after the ownership choices were presented. The first delivery combines Option A's administrator-only server-host detection with Option C's per-user logical registry. It does not authorize deep native parity.

### Option A — Manage The Self-Hosted Server Host

Agent roots and native state refer to the operating-system account running the PromptHub Web server. This most closely resembles Desktop and can reuse core filesystem adapters, but server-host state is machine-wide while settings are currently per-user. The design must define admin-only or single-user authority, user-scoped Provider records, secret custody, audit logging, filesystem allowlists, and disabled process-launch/update operations unless separately approved.

### Option B — Manage A Connected Desktop Device

The Web UI selects a registered Desktop device and sends typed Agent requests to that device. This preserves the meaning of local paths and Desktop adapters, but requires a new authenticated device RPC/queue protocol, online/offline state, replay protection, per-action authorization, result/audit records, and no direct browser-to-device trust.

### Option C — Logical Agent Registry Only

Web manages per-user built-in visibility, custom Agent definitions, root/path metadata, and identity preferences as portable settings. Detection, config files, providers, sessions, usage, launch, updates, and asset installation stay disabled. This is the smallest and safest first delivery but is not feature parity with the current Desktop Agent workbench.

## `DES-WEB-AGENT-001`: Web Inventory Contract

Add an authenticated `GET /api/agents` inventory contract. The response declares `server-host` for administrators and `logical-only` for other users, returns canonical managed Agent summaries, and declares the high-level Web capability matrix. The client derives tabs/actions from the returned per-Agent capabilities. Inventory composition reuses `packages/core/src/agent-management`; shared contracts belong in `packages/shared`; server authorization and detection policy belong in `apps/web`; the embedded renderer remains presentation/state only.

## `DES-WEB-AGENT-002`: Ownership And Isolation

`SettingsService` remains the source of truth for per-user Agent preferences. Administrators may perform shallow existence checks for their configured server-host roots. Non-admin requests use a detector that always returns false and therefore cannot use the endpoint as a server filesystem oracle. Provider Profiles, sessions, config contents, process launch, updates, and filesystem mutations remain unavailable because their current storage and adapters are not user-scoped Web contracts.

## `DES-WEB-AGENT-003`: Bounded Inventory Performance

Inventory work is limited to the canonical built-in list plus at most 32 validated custom Agents. Root checks run concurrently and use a short-lived bounded cache. No Agent subtree, session directory, config file, executable path, or asset directory is recursively scanned. Search remains client-side over the bounded result and the sidebar stays virtualized.

## `DES-WEB-AGENT-004`: Portable Settings Synchronization

Web settings validation and Desktop snapshot normalization preserve all logical Agent fields: built-in overrides, custom Agents, legacy custom roots, disabled IDs, and Codex identity preferences. Invalid identity values and oversized collections fail validation before persistence or sync import.

## Affected Areas

- Data model: no migration; logical Agent state reuses per-user `user_settings`.
- IPC / API: add authenticated REST inventory and a browser bridge method; Desktop IPC remains unchanged.
- Filesystem / sync: administrator inventory performs shallow root existence checks only; sync preserves portable logical Agent settings.
- UI / UX: Agents navigation becomes conditional on the capability response; unsupported tabs/actions remain disabled with guidance.

## Analyze Result

- Requirement links: `FR-WEB-AGENT-001` through `NFR-WEB-AGENT-001`.
- Verification links: `TEST-WEB-AGENT-001` through `TEST-WEB-AGENT-004`.
- Blocking conflicts: none for the selected initial slice.
- Deferred decisions: user-scoped Provider/session/config storage and connected-device RPC require separate changes.

## Traceability

| Requirement         | Design                    | Verification                | Task                     |
| ------------------- | ------------------------- | --------------------------- | ------------------------ |
| `FR-WEB-AGENT-001`  | `DES-WEB-AGENT-001`, `002` | `TEST-WEB-AGENT-001`, `002` | `T-WEB-AGENT-004`, `005` |
| `FR-WEB-AGENT-002`  | `DES-WEB-AGENT-001`        | `TEST-WEB-AGENT-002`        | `T-WEB-AGENT-005`        |
| `FR-WEB-AGENT-003`  | `DES-WEB-AGENT-002`, `004` | `TEST-WEB-AGENT-001`, `003` | `T-WEB-AGENT-004`, `005` |
| `NFR-WEB-AGENT-001` | `DES-WEB-AGENT-003`        | `TEST-WEB-AGENT-004`        | `T-WEB-AGENT-006`        |
