# CC Switch Capability Coverage

## Purpose

This document defines what “cover most CC Switch capabilities” means for PromptHub. CC Switch is the approved Provider and credential workflow reference; PromptHub adapts that workflow to its own security and architecture boundaries.

- Comparison date: 2026-07-28
- CC Switch source baseline: stable tag `v3.18.0`, commit
  `606e7bbe75db7f8285f7a3be006fac22b5d22796`
- PromptHub baseline: current workspace before Agent management implementation

The audited checkout lives outside the PromptHub repository at
`/Users/lingxiaotian/Programs/public/cc-switch`. Keeping it outside application
`public/` directories prevents third-party source, tests, screenshots and build
artifacts from being bundled into PromptHub desktop or web distributions.

## Official References

- [CC Switch README](https://github.com/farion1231/cc-switch/blob/main/README.md)
- [User manual index](https://github.com/farion1231/cc-switch/blob/main/docs/user-manual/en/README.md)
- [Add providers](https://github.com/farion1231/cc-switch/blob/main/docs/user-manual/en/2-providers/2.1-add.md)
- [Switch providers](https://github.com/farion1231/cc-switch/blob/main/docs/user-manual/en/2-providers/2.2-switch.md)
- [MCP management](https://github.com/farion1231/cc-switch/blob/main/docs/user-manual/en/3-extensions/3.1-mcp.md)
- [Prompt management](https://github.com/farion1231/cc-switch/blob/main/docs/user-manual/en/3-extensions/3.2-prompts.md)
- [Session management](https://github.com/farion1231/cc-switch/blob/main/docs/user-manual/en/3-extensions/3.4-sessions.md)
- [Proxy service](https://github.com/farion1231/cc-switch/blob/main/docs/user-manual/en/4-proxy/4.1-service.md)
- [Usage statistics](https://github.com/farion1231/cc-switch/blob/main/docs/user-manual/en/4-proxy/4.4-usage.md)
- [Model test](https://github.com/farion1231/cc-switch/blob/main/docs/user-manual/en/4-proxy/4.5-model-test.md)
- [Settings and CLI management](https://github.com/farion1231/cc-switch/blob/main/docs/user-manual/en/1-getting-started/1.5-settings.md)
- [Deep-link import](https://github.com/farion1231/cc-switch/blob/main/docs/user-manual/en/5-faq/5.3-deeplink.md)
- [v3.18.0 release](https://github.com/farion1231/cc-switch/releases/tag/v3.18.0)
- [MIT license](https://github.com/farion1231/cc-switch/blob/v3.18.0/LICENSE)

## Source Audit And Reuse Boundary

The user approved CC Switch as the interaction and workflow reference for
Agent Provider and credential management on 2026-07-28, and clarified on
2026-07-29 that reuse means selective adaptation rather than repository or
subsystem copying. The following v3.18.0 implementation areas were inspected:

- `src-tauri/src/database/schema.rs`: Provider metadata in a SQLite source of
  truth.
- `src-tauri/src/services/provider/mod.rs` and
  `src-tauri/src/services/provider/live.rs`: import, selection, live projection,
  backup ownership and rollback orchestration.
- `src-tauri/src/commands/provider.rs`: explicit user-triggered import and
  Provider commands.
- `src-tauri/src/codex_config.rs`: Codex `auth.json` / `config.toml` reads,
  atomic writes and restoration.

PromptHub adopts the proven product shape: Provider library, explicit native
import, current Provider selection, preview before takeover, live projection,
verification and rollback. The MIT license permits selective source reuse, but
reuse is decided per component rather than by copying the repository into
PromptHub:

- CC Switch Provider `settings_config` can contain credential material in its
  SQLite record. PromptHub credentials remain main-process-only in Electron
  `safeStorage`; SQLite, renderer state, logs and portable exports receive only
  readiness state.
- Proxy takeover, protocol conversion, OAuth account pooling and failover are
  separate high-risk phases, not implied by credential management.
- Public workflows, contracts, algorithms and interaction patterns may be
  adapted under PromptHub's own architecture. A source file or isolated module
  may be reused only after its boundary is smaller and safer than an
  independent implementation, the pinned upstream commit and license notice
  are recorded, and PromptHub-specific security and regression tests pass.
- The external checkout is research input, not an application asset. It stays
  outside PromptHub, is never copied into an app `public/` directory, and is
  never bundled into desktop or web releases.

### Reuse decision rules

| Upstream material                                                      | Decision                                                                                                                                     |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider workflow, state machine, preview/confirm/rollback interaction | Adapt the behavior and terminology to PromptHub's existing Profile and activation services.                                                  |
| Small pure parser, normalizer or deterministic algorithm               | Reuse or port only when it has a clear module boundary; record upstream path, tag/commit, license and PromptHub tests.                       |
| Tauri command, Rust service, SQLite schema or whole React screen       | Do not transplant it as a parallel subsystem; PromptHub already owns the corresponding Electron, DB and renderer boundaries.                 |
| Credential persistence, OAuth token handling or proxy takeover         | Do not inherit by convenience. Apply PromptHub's main-process secret custody and require a separate threat model for any expanded authority. |
| Icons, screenshots, names and other brand assets                       | Do not reuse merely because source code is MIT; verify the asset's own rights and product need separately.                                   |

Any source-level reuse must be visible in the change implementation record and
the repository's applicable third-party notice. Behavior-only inspiration does
not create a runtime dependency, but still records the pinned evidence used to
make compatibility decisions.

The current PromptHub worktree uses CC Switch as behavior and protocol evidence
only. No CC Switch source file, React component, Rust service, schema, asset or
runtime dependency has been copied into PromptHub. If a later batch ports a
substantial code fragment, that batch must add the MIT notice and exact
upstream provenance before the code can ship.

The credential editor therefore follows the useful upstream interaction
pattern without inheriting its persistence model: users can intentionally keep,
replace or remove a Profile credential, and may temporarily reveal only the new
value they are currently typing. PromptHub never reads an existing stored
credential back into the renderer. This is behavior-level adaptation, not
source-level reuse.

## Coverage Matrix

| Capability                  | CC Switch reference behavior                                                          | PromptHub current baseline                                                                                                                               | Target                                                                                                                                                            | Phase         |
| --------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Supported Agent registry    | Manages Claude Code, Claude Desktop, Codex, Gemini CLI, OpenCode, OpenClaw and Hermes | Has a broader built-in/custom Agent platform registry, primarily used for asset paths and distribution                                                   | Show the complete existing registry as first-class managed Agents; prioritize common/detected/configured entries without hiding platforms that lack deep adapters | Phase 1       |
| Installation/path detection | Custom app directories and CLI diagnostics                                            | Existing path overrides and platform detection are distributed across settings/services                                                                  | Unified installation, version, path, capability and health summary                                                                                                | Phase 1       |
| Provider presets            | Presets plus custom and universal providers                                           | PromptHub AI settings manage its own providers/models, not Agent-native provider profiles                                                                | Per-Agent Provider Profiles; optional creation from compatible PromptHub providers                                                                                | Phase 1       |
| Native config import        | Imports current/native provider configuration                                         | No unified Agent-native provider import                                                                                                                  | Explicit read/normalize/redact/import with provenance                                                                                                             | Phase 1       |
| Provider switching          | Writes Agent-native config and exposes current state                                  | No unified provider activation service                                                                                                                   | Preview, backup, atomic write, verification, backfill and rollback                                                                                                | Phase 1       |
| Tray quick switching        | Per-app current provider and quick switch                                             | Tray has Agent asset actions but no provider switch                                                                                                      | Use the same verified activation service from tray                                                                                                                | Phase 1       |
| Model mappings              | Provider configuration and model refresh                                              | PromptHub has model routes for its own AI use                                                                                                            | Per-Agent adapter-defined model mappings                                                                                                                          | Phase 1       |
| Provider/model testing      | Real streaming model/key/endpoint test with latency                                   | No Agent-native model test                                                                                                                               | Isolated connection and stream test with redacted diagnostics                                                                                                     | Phase 1       |
| MCP management              | Unified presets/custom MCP and app binding/sync                                       | Existing MCP library and target reconciliation are already substantial                                                                                   | Surface canonical MCP states/actions per Agent; do not duplicate                                                                                                  | Phase 1       |
| Skills management           | Unified Skill install/sync                                                            | Existing Skill library, import, versioning and multi-platform distribution are stronger foundations                                                      | Surface canonical Skill states/actions per Agent                                                                                                                  | Phase 1       |
| Prompt/rules files          | Manages CLAUDE.md, AGENTS.md, GEMINI.md and smart backfill                            | Prompt and Rules are richer separate domains; platform rule projection exists in parts                                                                   | Aggregate Rules/Prompt-related config with external-change reconciliation                                                                                         | Phase 1/2     |
| Plugins                     | Not the primary documented parity surface                                             | PromptHub already has a Plugin domain and platform distribution                                                                                          | Include Plugin state in Agent assets where supported                                                                                                              | Phase 1       |
| Sessions                    | Browse/search/read/resume multiple tool sessions                                      | Platform history paths are documented but no unified browser exists                                                                                      | Verified adapters, local metadata index, on-demand transcript, resume                                                                                             | Phase 1/2     |
| Config file management      | Central settings and app-specific configuration                                       | Paths/configs are fragmented                                                                                                                             | Allowlisted file inventory, redacted diff, snapshots and safe edits                                                                                               | Phase 1       |
| Universal providers         | Sync one provider definition across compatible apps                                   | Not implemented                                                                                                                                          | Explicit per-platform projections with independent preview/rollback                                                                                               | Phase 2       |
| Provider quota/balance      | Some providers expose quota/balance                                                   | Not implemented                                                                                                                                          | Optional adapter with source/freshness labels                                                                                                                     | Phase 2       |
| CLI install/update/diagnose | Managed CLI lifecycle                                                                 | Read-only, shell-free diagnostics for seven evidence-backed CLIs; OpenCode additionally has explicit review/confirm/update/verify/exact-version recovery | Add install and further update adapters only with official source/recovery evidence; retain truthful unsupported states elsewhere                                 | Phase 2       |
| Model list refresh          | Fetches provider model lists                                                          | PromptHub AI model discovery does not cover all Agent configs                                                                                            | Provider adapter refresh with explicit merge                                                                                                                      | Phase 2       |
| Usage statistics            | Session/proxy-derived request, token and cost views                                   | Not implemented for Agents                                                                                                                               | Local session usage first; proxy/provider data remain distinct                                                                                                    | Phase 2       |
| Deep-link import            | `ccswitch://` imports providers and extensions                                        | No Agent import protocol                                                                                                                                 | Versioned `prompthub://` preview and confirm flow                                                                                                                 | Phase 2       |
| Cloud sync                  | Syncs configuration between devices                                                   | PromptHub already has backup/sync foundations                                                                                                            | Sync non-secret profiles/preferences; device-local paths and sessions excluded                                                                                    | Phase 2       |
| Local proxy                 | Routes current providers through a local service                                      | Not implemented                                                                                                                                          | Separate subsystem with explicit enablement                                                                                                                       | Phase 3       |
| Protocol conversion         | Converts compatible request protocols                                                 | Not implemented                                                                                                                                          | Separate adapter/security/performance design                                                                                                                      | Phase 3       |
| Failover                    | Provider queues and health-based fallback                                             | Not implemented                                                                                                                                          | Separate routing policy and observability                                                                                                                         | Phase 3       |
| Request logs/cost           | Proxy-observed traffic and cost                                                       | Not implemented                                                                                                                                          | Only with proxy subsystem and retention/redaction controls                                                                                                        | Phase 3       |
| OAuth account/reverse proxy | Some providers and accounts use OAuth helpers                                         | No equivalent                                                                                                                                            | Not committed; requires separate legal/security decision                                                                                                          | Separate gate |

## PromptHub Advantages To Preserve

PromptHub should not become a thin CC Switch clone. Its existing advantages must remain architectural inputs:

- Broader Agent platform registry and custom Agent path support.
- Stronger Prompt, Skill, Rules, MCP and Plugin library ownership.
- Skill versioning, local repository handling, distribution and recovery.
- Local-first backup, WebDAV/self-hosted sync and cross-domain recovery.
- Shared desktop/CLI/web packages and typed IPC/contracts.
- Existing change governance, regression harness and multi-platform release pipeline.

The Agent workspace should expose those capabilities by Agent without moving their source of truth.

## Deliberate Non-Parity

PromptHub will not claim parity for a capability until its real platform behavior is verified. The following are intentionally excluded from the first delivery:

- Reverse-engineered OAuth flows or account pooling.
- Silent credential import/export.
- Automatic traffic interception or hidden local proxy startup.
- One universal config shape that discards platform-specific fields.
- Editing or synchronizing external session bodies by default.
- Provider switching for a platform that only has path detection but no verified adapter.

## Coverage Definition

“Most CC Switch capabilities covered” is reached when all Phase 1 and Phase 2 rows are delivered for the declared supported platforms, with Phase 3 clearly available as an optional separate subsystem or explicitly excluded. Counting menu items is not sufficient; each capability requires tested import, failure, compatibility, privacy and rollback behavior.
