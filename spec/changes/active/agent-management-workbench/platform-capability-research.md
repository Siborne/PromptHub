# Agent Provider, Model And Session Capability Research

## Scope And Evidence Policy

This inventory records only capabilities supported by first-party documentation,
first-party source code, or a verified local runtime. PromptHub does not enable an
adapter from an inferred filename alone. A platform remains visible when a deep
adapter is unavailable.

Research refreshed on 2026-07-15.

## Provider And Model Configuration

| Platform    | Native configuration                                                                                                                     | Supported management direction                                                                                                                            | Credential boundary                                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Claude Code | `~/.claude/settings.json`; model fields include `model`, `availableModels`, `modelOverrides`, and provider environment values            | Structured model/default-model editing; provider projection through a redacted plan; preserve unrelated settings                                          | OAuth remains platform-owned. API keys and tokens must not enter renderer payloads or ordinary PromptHub JSON         |
| Codex CLI   | `~/.codex/config.toml`; `model`, `model_provider`, `model_providers`, `profiles`, `model_reasoning_effort`                               | Structured TOML inspection, profile/model selection, and previewed activation with backup/verify/rollback                                                 | Preserve Codex auth/keyring ownership. PromptHub-owned secrets use encrypted secret references                        |
| Gemini CLI  | `~/.gemini/settings.json`; `model.name`, `modelConfigs`, `security.auth.selectedType`; model can also be supplied through `GEMINI_MODEL` | Structured default-model and generation preset editing; authentication method readiness; provider-specific environment projection only after secret audit | Google login, ADC, and service-account credentials stay platform-owned. API keys are sensitive secret references      |
| OpenCode    | `~/.config/opencode/opencode.json` or `opencode.jsonc`; `model`, `small_model`, and `provider`                                           | Structured model/provider editing; model catalog through `opencode models`; use native auth commands when credentials must change                         | `~/.local/share/opencode/auth.json` is an authentication artifact and is never exposed as a raw editable config file  |
| OpenClaw    | `~/.openclaw/openclaw.json`; `agents.defaults.model`, fallbacks, allowlist, and `models.providers`                                       | Prefer `openclaw models status/list/set` and `openclaw config` commands over direct mutation; support aliases and fallbacks after the base adapter        | Native auth profiles and SecretRef markers remain platform-owned. Status may expose readiness but not literal secrets |
| Cline       | Provider/model state is owned by Cline storage; current first-party source includes task-scoped settings and provider settings services  | Keep Provider & Model partial until the current VS Code/CLI storage contract and migration path are fixture-tested                                        | VS Code secrets and Cline credential storage must not be copied into PromptHub                                        |

### First-Party References

- Claude Code settings and model selection:
  <https://code.claude.com/docs/en/settings> and
  <https://code.claude.com/docs/en/model-config>
- Codex configuration schema and source:
  <https://github.com/openai/codex/blob/main/codex-rs/core/config.schema.json>
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

## Session And History Storage

| Platform          | Verified source                                                                                                                                   | Native operations                                                                                     | PromptHub adapter policy                                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Claude Code       | `~/.claude/projects/<project>/<session-id>.jsonl` or the directory selected by `CLAUDE_CONFIG_DIR`                                                | Resume by session id; export through Claude interfaces                                                | Bounded metadata scan and on-demand read only. Treat JSONL entries as versioned internal data and tolerate unknown/malformed rows                                                    |
| Codex CLI/Desktop | `~/.codex/session_index.jsonl`, `state_*.sqlite`, and rollout JSONL under `~/.codex/sessions/`                                                    | Native resume/list behavior                                                                           | Index/SQLite first, lazy rollout reads, strict byte limits, and no full recursive parse. Missing/corrupt rollout state must remain a partial result                                  |
| Gemini CLI        | `~/.gemini/tmp/<project_hash>/chats/`                                                                                                             | `--list-sessions`, `--resume`, `--delete-session`; configurable retention                             | Bounded project/chat scan with tolerant partial JSON parsing for read-only viewing and resume. Native delete remains deferred until confirmation and rollback behavior are specified |
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
  Code, Codex CLI, Gemini CLI, OpenCode, and OpenClaw. JSON/JSONC writes preserve
  unrelated fields; Codex TOML writes create a backup and surface the possible
  formatting change.
- Provider endpoints returned to the renderer remove user info, query strings,
  and fragments. Literal keys and tokens are never returned.
- Read-only session browse, local search, bounded detail, and resume-command
  copy are enabled for Claude Code, Gemini CLI, and OpenCode.
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
