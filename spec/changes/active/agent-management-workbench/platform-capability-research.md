# Agent Provider, Model And Session Capability Research

## Scope And Evidence Policy

This inventory records only capabilities supported by first-party documentation,
first-party source code, or a verified local runtime. PromptHub does not enable an
adapter from an inferred filename alone. A platform remains visible when a deep
adapter is unavailable.

Research refreshed on 2026-07-22.

## Google Product Identity And Asset Boundary

Google announced on 2026-05-19 that it was transitioning the consumer terminal
experience from Gemini CLI to Antigravity CLI. Gemini CLI stopped serving Free,
Google AI Pro and Ultra requests on 2026-06-18. Enterprise licenses, Google
Cloud and paid Gemini API keys remain supported, which explains the continuing
Gemini CLI releases without making it a current consumer entry point.

PromptHub keeps both platform ids without presenting them as equivalent current
products. `antigravity` is the current Google Agent and uses
`~/.gemini/config` as the shared managed customization root for Skills, MCP,
and Plugins, with global Rules at `~/.gemini/GEMINI.md`. `gemini` retains its
provider and session adapters as an enterprise/legacy compatibility target. The CLI runtime root
`~/.gemini/antigravity-cli` and desktop runtime root
`~/.gemini/antigravity` remain product-owned state and require separate
provider/session adapters before PromptHub exposes deep management.

First-party references:

- <https://github.com/google-gemini/gemini-cli/discussions/27274>
- <https://github.com/google-gemini/gemini-cli/blob/main/docs/changelogs/index.md>
- <https://antigravity.google/docs/cli-overview>
- <https://antigravity.google/docs/gcli-migration>
- <https://antigravity.google/docs/skills>
- <https://antigravity.google/docs/mcp>
- <https://antigravity.google/docs/plugins>

## Qwen Code Product And Asset Boundary

Qwen Code is a standalone open-source terminal Agent maintained in
`QwenLM/qwen-code`. It is not Qoder and must not reuse the `qoder` platform id,
root, or inferred Skill convention. PromptHub uses built-in id `qwen`, display
name `Qwen Code`, default user root `~/.qwen`, and honors `QWEN_HOME` before the
default. `QWEN_RUNTIME_DIR` controls conversations, logs, and todos only.

Verified first-party asset contracts:

| Domain     | User scope                                                                  | Project scope                                     | Ownership boundary                                                                                                          |
| ---------- | --------------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Skills     | `~/.qwen/skills/<name>/SKILL.md`; source also discovers `~/.agents/skills/` | `.qwen/skills/<name>/SKILL.md`                    | Complete package directory; `.agents/skills` is compatibility discovery, not the default Qwen write target                  |
| SubAgents  | `~/.qwen/agents/*.md`                                                       | `.qwen/agents/*.md`                               | Markdown plus YAML frontmatter (`name`, `description`, model/tool policy); extension-provided agents remain extension-owned |
| MCP        | `~/.qwen/settings.json` `mcpServers`                                        | `.qwen/settings.json` `mcpServers`                | Native `qwen mcp --scope user                                                                                               | project` or structured JSON merge; preserve unrelated settings |
| Rules      | `~/.qwen/QWEN.md`                                                           | repository `QWEN.md`; local `.qwen/QWEN.local.md` | Explicit instruction scopes; auto-memory and team memory are not Rules                                                      |
| Extensions | `~/.qwen/extensions/<name>/qwen-extension.json`                             | `.qwen/extensions/<name>/qwen-extension.json`     | Parent bundle owns included Skills, SubAgents, MCP, commands, and hooks                                                     |
| Commands   | `~/.qwen/commands/*.md`                                                     | `.qwen/commands/*.md`                             | Discovery-only until PromptHub has a Commands owning domain                                                                 |
| Sessions   | runtime root `projects/<sanitized-project>/chats/`                          | selected by native CLI project context            | Prefer bounded `qwen sessions list --json`; no recursive runtime scan                                                       |

Security exclusions are mandatory. Qwen provider/API keys, `env` values, MCP
headers/environment values, OAuth client secrets, `mcp-oauth-tokens.json`,
`mcp-oauth-tokens-v2.json`, credentials, sessions, logs, todos, auto-memory, and
`.qwen/team-memory/` never enter renderer payloads or ordinary backup/sync. The
system and system-default settings layers are inspection context only; PromptHub
does not edit administrator policy files in this delivery.

First-party references:

- <https://github.com/QwenLM/qwen-code>
- <https://github.com/QwenLM/qwen-code/blob/main/docs/users/configuration/settings.md>
- <https://github.com/QwenLM/qwen-code/blob/main/docs/users/features/skills.md>
- <https://github.com/QwenLM/qwen-code/blob/main/docs/users/features/sub-agents.md>
- <https://github.com/QwenLM/qwen-code/blob/main/docs/users/features/mcp.md>
- <https://github.com/QwenLM/qwen-code/blob/main/docs/users/features/memory.md>
- <https://github.com/QwenLM/qwen-code/blob/main/docs/users/features/commands.md>
- <https://github.com/QwenLM/qwen-code/blob/main/docs/users/extension/introduction.md>

## Provider And Model Configuration

| Platform    | Native configuration                                                                                                                                               | Supported management direction                                                                                                                              | Credential boundary                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Claude Code | `~/.claude/settings.json`; model fields include `model`, `availableModels`, `modelOverrides`, and provider environment values                                      | Structured model/default-model editing; provider projection through a redacted plan; preserve unrelated settings                                            | OAuth remains platform-owned. API keys and tokens must not enter renderer payloads or ordinary PromptHub JSON             |
| Codex CLI   | `~/.codex/config.toml`; `model`, `model_provider`, `model_providers`, `profiles`, `model_reasoning_effort`                                                         | Structured TOML inspection, profile/model selection, and previewed activation with backup/verify/rollback                                                   | Preserve Codex auth/keyring ownership. PromptHub-owned secrets use encrypted secret references                            |
| Kimi Code   | Current `KIMI_CODE_HOME` / `~/.kimi-code/config.toml`; `default_model`, `models`, and `providers`; legacy `KIMI_SHARE_DIR` / `~/.kimi` is fallback-only            | Inspect and update the non-secret default-model projection with backup, atomic replace, semantic reread, rollback, and `kimi doctor config` when available  | Literal `api_key`, authorization headers, `credentials/`, and token-bearing provider values never enter renderer payloads |
| Qwen Code   | `QWEN_HOME` / `~/.qwen/settings.json`; project `.qwen/settings.json`; `modelProviders`, `security.auth.selectedType`, `model.name`, and `env`                      | Redacted inspection first; later structured user/project editing must respect settings precedence and preserve unrelated fields                             | Provider keys, expanded `env`, auth state, and token files stay main-only and are excluded from backup/sync               |
| Gemini CLI  | `~/.gemini/settings.json`; enterprise/paid-API compatibility only after the 2026-06-18 consumer cutoff; `model.name`, `modelConfigs`, `security.auth.selectedType` | Preserve structured inspection/editing for supported enterprise users; direct Free/Pro/Ultra users to Antigravity instead of claiming consumer availability | Google login, ADC, and service-account credentials stay platform-owned. API keys are sensitive secret references          |
| OpenCode    | `~/.config/opencode/opencode.json` or `opencode.jsonc`; `model`, `small_model`, and `provider`                                                                     | Structured model/provider editing; model catalog through `opencode models`; use native auth commands when credentials must change                           | `~/.local/share/opencode/auth.json` is an authentication artifact and is never exposed as a raw editable config file      |
| OpenClaw    | `~/.openclaw/openclaw.json`; `agents.defaults.model`, fallbacks, allowlist, and `models.providers`                                                                 | Prefer `openclaw models status/list/set` and `openclaw config` commands over direct mutation; support aliases and fallbacks after the base adapter          | Native auth profiles and SecretRef markers remain platform-owned. Status may expose readiness but not literal secrets     |
| Cline       | Provider/model state is owned by Cline storage; current first-party source includes task-scoped settings and provider settings services                            | Keep Provider & Model partial until the current VS Code/CLI storage contract and migration path are fixture-tested                                          | VS Code secrets and Cline credential storage must not be copied into PromptHub                                            |

### First-Party References

- Claude Code settings and model selection:
  <https://code.claude.com/docs/en/settings> and
  <https://code.claude.com/docs/en/model-config>
- Codex configuration schema and source:
  <https://github.com/openai/codex/blob/main/codex-rs/core/config.schema.json>
- Kimi Code data locations, configuration, and providers:
  <https://moonshotai.github.io/kimi-code/en/configuration/data-locations.html>,
  <https://moonshotai.github.io/kimi-code/en/configuration/config-files.html>, and
  <https://moonshotai.github.io/kimi-code/en/configuration/providers.html>
- Qwen Code settings and model providers:
  <https://github.com/QwenLM/qwen-code/blob/main/docs/users/configuration/settings.md> and
  <https://github.com/QwenLM/qwen-code/blob/main/docs/users/configuration/model-providers.md>
- Gemini CLI configuration and advanced model configuration:
  <https://geminicli.com/docs/reference/configuration/> and
  <https://geminicli.com/docs/cli/generation-settings/>
- OpenCode providers, configuration, and CLI:
  <https://opencode.ai/docs/providers>,
  <https://dev.opencode.ai/docs/config/>, and
  <https://dev.opencode.ai/docs/cli/>
- OpenClaw models and providers:
  <https://docs.openclaw.ai/cli/models>,
  <https://docs.openclaw.ai/concepts/model-providers>, and
  <https://docs.openclaw.ai/gateway/config-tools>
- Cline storage source:
  <https://github.com/cline/cline/blob/main/apps/vscode/src/core/storage/disk.ts>

## Official Subscription Quota Matrix

Quota support is enabled only when PromptHub has a bounded, provider-owned
source that corresponds to the platform's official subscription. API-key
billing, custom gateways, locally estimated token counts, and proxy-observed
traffic are separate evidence classes and must not be presented as official
subscription quota.

| Platform                       | Delivered source                                                                 | Reported dimensions                                                     | Authentication and runtime boundary                                                                                                                                  | Current status                    |
| ------------------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Claude Code                    | Anthropic OAuth usage endpoint                                                   | 5-hour, 7-day, and optional Opus windows; subscription type             | Native Keychain/file OAuth credential remains in main; custom Anthropic/cloud gateways short-circuit                                                                 | Supported                         |
| Codex / ChatGPT                | ChatGPT backend usage endpoint                                                   | Session and weekly windows; plan                                        | `~/.codex/auth.json` remains in main; non-OpenAI providers short-circuit                                                                                             | Supported                         |
| Kimi Code                      | Kimi coding usages endpoint                                                      | Weekly allowance, rolling window, membership level                      | Native Kimi OAuth credential remains in main                                                                                                                         | Supported and locally verified    |
| Antigravity                    | Running desktop language-service `GetUserStatus`; Cloud Code credential fallback | Monthly prompt credits, per-model remaining quota/reset, Google AI plan | Trusted Antigravity process + loopback-only port + in-memory CSRF. macOS Keychain and legacy files are fallback-only. PromptHub does not refresh Google OAuth tokens | Supported and locally verified    |
| Gemini CLI                     | Cloud Code Assist quota endpoint                                                 | Per-model remaining quota/reset and tier                                | Native Gemini OAuth credential remains in main; enterprise/paid compatibility after the consumer cutoff                                                              | Supported for compatible accounts |
| GitHub Copilot                 | Copilot user entitlement endpoint                                                | Premium/chat request entitlement, remaining amount, reset, plan         | Native GitHub/Copilot token remains in main                                                                                                                          | Supported                         |
| Qwen Code                      | No verified stable provider-owned subscription quota contract                    | None                                                                    | Do not infer quota from local request counters or read credentials merely to probe undocumented endpoints                                                            | Planned/disabled                  |
| Cursor and other preset Agents | No verified provider-owned quota contract                                        | None                                                                    | No credential probing or inferred quota                                                                                                                              | Planned/disabled                  |

Antigravity desktop verification on 2026-07-22 returned the signed-in plan,
monthly prompt credits, and eleven model quota buckets from the current local
session. The same account's Keychain access token was short-lived and stale
while a refresh token remained present, proving that access-token expiry alone
cannot be treated as logout. When Antigravity is not running, PromptHub now
returns `antigravity-not-running` rather than the generic expired-credential
state.

Quota safety rules:

- All credential, account, refresh-token, and CSRF values stay in Electron main
  memory and are excluded from IPC, persistence, logs, errors, and tests.
- Remote requests use fixed provider endpoints, a 10-second timeout, bounded
  response parsing, and a 60-second result cache.
- Antigravity local requests are fixed to `127.0.0.1`, require a process-bound
  CSRF value, use a 4-second timeout, and reject responses larger than 1 MiB.
- A provider adapter may report `ok`, `no-credentials`, `expired`, or
  `unavailable`; it must not fabricate a percentage when the provider reports
  no quota.

## Session And History Storage

| Platform          | Verified source                                                                                                                                   | Native operations                                                                                     | PromptHub adapter policy                                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Claude Code       | `~/.claude/projects/<project>/<session-id>.jsonl` or the directory selected by `CLAUDE_CONFIG_DIR`                                                | Resume by session id; export through Claude interfaces                                                | Bounded metadata scan and on-demand read only. Treat JSONL entries as versioned internal data and tolerate unknown/malformed rows                                                    |
| Codex CLI/Desktop | `~/.codex/session_index.jsonl`, `state_*.sqlite`, and rollout JSONL under `~/.codex/sessions/`                                                    | Native resume/list behavior                                                                           | Index/SQLite first, lazy rollout reads, strict byte limits, and no full recursive parse. Missing/corrupt rollout state must remain a partial result                                  |
| Gemini CLI        | `~/.gemini/tmp/<project_hash>/chats/`                                                                                                             | `--list-sessions`, `--resume`, `--delete-session`; configurable retention                             | Bounded project/chat scan with tolerant partial JSON parsing for read-only viewing and resume. Native delete remains deferred until confirmation and rollback behavior are specified |
| Kimi Code         | Current root `session_index.jsonl`; `sessions/<workDirKey>/<sessionId>/state.json`; transcript `agents/main/wire.jsonl`                           | Resume with `kimi --session <id>`                                                                     | Index-first bounded metadata reads, canonical-path containment, lazy transcript detail, malformed-row isolation, and no transcript mutation                                          |
| Qwen Code         | `QWEN_RUNTIME_DIR` or `QWEN_HOME` runtime root; per-project chats and runtime sidecars                                                            | `qwen sessions list --json` plus native resume/export surfaces                                        | Native CLI first with timeout/output cap, bounded metadata page, no recursive filesystem scan, and no transcript persistence in PromptHub                                            |
| OpenCode          | `~/.local/share/opencode/`; project storage contains session/message data                                                                         | `opencode session list --format json`, `session delete`, `export --sanitize`, resume with `--session` | Native CLI adapter. Use sanitized export for detail and never read `auth.json`                                                                                                       |
| OpenClaw          | `~/.openclaw/agents/<agentId>/sessions/sessions.json` and per-session JSONL; newer stores may be SQLite-backed                                    | Bounded JSON session list, tail, cleanup, compact, and trajectory export                              | Native CLI/RPC adapter. Prefer dry-run for maintenance and platform-managed cleanup over raw file deletion                                                                           |
| Cline             | Host global storage `tasks/<taskId>/`; files include `api_conversation_history.json`, `ui_messages.json`, `task_metadata.json`, and task settings | Native history and task deletion UI                                                                   | Adapter remains partial until host storage roots and CLI/VS Code variants are normalized and tested                                                                                  |

### Session Safety Decisions

- Session bodies stay local, platform-owned, excluded from normal backup, sync,
  telemetry, and search indexing.
- The renderer receives only the page explicitly requested by the user, with
  per-entry and total response byte limits.
- PromptHub never edits transcript content.
- Resume launches or copies a validated executable plus argument array. It does
  not build a shell command from transcript data.
- Destructive actions use a native platform command when available. Raw-file
  adapters may offer move-to-trash only after a separate confirmation and
  rollback test; direct `unlink` is not a generic session action.
- Native retention and cleanup controls are shown separately from individual
  session deletion.

### Implemented Baseline

- Non-secret model inspection and default-model updates are enabled for Claude
  Code, Codex CLI, Kimi Code, Gemini CLI, OpenCode, and OpenClaw. JSON/JSONC
  writes preserve unrelated fields; Codex and Kimi TOML writes create a backup
  and surface the possible formatting change. Kimi additionally runs its native
  config doctor when available.
- Provider endpoints returned to the renderer remove user info, query strings,
  and fragments. Literal keys and tokens are never returned.
- Read-only session browse, local search, bounded detail, and resume-command
  copy are enabled for Claude Code, Gemini CLI, Kimi Code, and OpenCode.
- Claude and Gemini file adapters cap scanned files, metadata bytes, detail
  bytes, and entry text. OpenCode uses bounded native JSON commands and
  sanitized export instead of scanning its multi-gigabyte data root.
- Codex, OpenClaw, Cline, and other session tabs remain disabled until their
  index or native command adapters pass representative fixture and scale tests.

### First-Party References

- Claude Code sessions:
  <https://code.claude.com/docs/en/sessions>
- Gemini CLI sessions:
  <https://geminicli.com/docs/cli/session-management/>
- OpenCode storage and session commands:
  <https://dev.opencode.ai/docs/troubleshooting/> and
  <https://dev.opencode.ai/docs/cli/>
- Kimi Code sessions and command reference:
  <https://moonshotai.github.io/kimi-code/en/guides/sessions.html> and
  <https://moonshotai.github.io/kimi-code/en/reference/kimi-command.html>
- Qwen Code session command source and runtime path helpers:
  <https://github.com/QwenLM/qwen-code/tree/main/packages/cli/src/commands/sessions> and
  <https://github.com/QwenLM/qwen-code/blob/main/packages/core/src/config/storage.ts>
- OpenClaw session stores and commands:
  <https://docs.openclaw.ai/session> and
  <https://docs.openclaw.ai/cli/sessions>
- Codex session failure evidence and storage invariants:
  <https://github.com/openai/codex/issues/20340>,
  <https://github.com/openai/codex/issues/21196>, and
  <https://github.com/openai/codex/issues/22004>
- Cline task storage source:
  <https://github.com/cline/cline/blob/main/apps/vscode/src/core/storage/disk.ts>

## Verified Local Scale

The development machine was inspected using path, file-count, and size metadata
only. No transcript body or credential file was read.

| Source                        |  Files | Approximate size | Design consequence                                                  |
| ----------------------------- | -----: | ---------------: | ------------------------------------------------------------------- |
| Claude projects               |     87 |            73 MB | Bounded file metadata scan is acceptable                            |
| Codex sessions                |    219 |            13 GB | Index-first and lazy reads are mandatory                            |
| Gemini temporary project data |    751 |           180 MB | Project grouping and pagination are required                        |
| Kimi Code sessions            |      3 |            40 KB | Small locally, but the append-only index remains the bounded source |
| OpenCode application data     | 25,948 |           5.9 GB | Native CLI/database query is required; recursive scan is prohibited |
| OpenClaw agents               |      3 |            48 KB | Native CLI remains preferred because formats can migrate            |

## Credential Audit Result

PromptHub's existing `config/ai-models.json` stores provider and model API keys as
plain text and exposes them to renderer state. It cannot be reused as the Agent
Provider Profile secret store.

The desktop cloud-account implementation already demonstrates an Electron
`safeStorage`-backed encrypted file with atomic replacement and owner-only file
permissions. Agent Provider Profiles should extract a generic version of this
pattern:

1. SQLite or ordinary config stores only `secret_ref` and non-secret fields.
2. The encrypted secret file is read and written only in Electron main.
3. Renderer APIs accept a new secret during save but never receive it on read.
4. Native adapters receive the resolved value only while planning/applying a
   specific operation.
5. Default backup/export contains secret requirements, not secret values.

Until that abstraction and its security tests land, Provider & Model may inspect
native state and safely edit non-secret model fields, but it must not claim full
provider-profile switching support.
