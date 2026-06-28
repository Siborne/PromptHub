# CLI Delta Spec

## Modified Requirements

### Requirement: CLI Workspace Uses Sync Snapshot Semantics

PromptHub CLI workspace export/import MUST use a sync-compatible workspace snapshot rather than a prompt-only bundle.

#### Scenario: CLI exports a full local workspace snapshot

- **GIVEN** the local workspace contains prompts, folders, rules, skills, My MCP, and My Plugin data
- **WHEN** the user runs `prompthub workspace export --file <path>`
- **THEN** the exported JSON contains a `SyncSnapshot`-compatible `payload`
- **AND** the summary includes prompt, folder, version, rule, skill, MCP server, and plugin counts.

#### Scenario: CLI imports a full local workspace snapshot

- **GIVEN** a `prompthub-cli-workspace` v2 bundle contains prompts, folders, prompt versions, rules, skills, skill versions, My MCP, and My Plugin data
- **WHEN** the user runs `prompthub workspace import --file <path> --force-clear`
- **THEN** the CLI restores those resources into the shared local workspace sources it can access from core.

#### Scenario: CLI imports an old prompt-only bundle

- **GIVEN** a legacy `prompthub-cli-workspace` v1 bundle
- **WHEN** the user imports it
- **THEN** prompt, folder, and prompt-version data continue to import successfully.

### Requirement: CLI Remote Sync Uses The Same Snapshot Contract

PromptHub CLI MUST provide a minimal remote sync command surface for self-hosted Web and Cloudflare-compatible sync endpoints.

#### Scenario: CLI pushes local workspace to remote sync

- **GIVEN** the user has a self-hosted or Cloudflare endpoint and bearer token
- **WHEN** they run `prompthub sync push --endpoint <url> --token <token>`
- **THEN** the CLI sends the same `SyncSnapshot` payload used by workspace export to `PUT /api/sync/data`.

#### Scenario: CLI pulls remote sync into local workspace

- **GIVEN** the user has a remote snapshot at `GET /api/sync/data`
- **WHEN** they run `prompthub sync pull --endpoint <url> --token <token> --force-clear`
- **THEN** the CLI restores that snapshot using the same local restore path as workspace import.

#### Scenario: CLI checks Cloudflare sync status

- **GIVEN** Cloudflare exposes `/api/sync/manifest` but not `/api/sync/status`
- **WHEN** the user runs `prompthub sync status --endpoint <url> --token <token>`
- **THEN** the CLI falls back from `/api/sync/status` to `/api/sync/manifest`.

## Deferred

Persistent CLI login/profile storage remains deferred. The first remote sync surface accepts `--endpoint` / `--token` or `PROMPTHUB_SYNC_ENDPOINT` / `PROMPTHUB_SYNC_TOKEN` / `PROMPTHUB_TOKEN`.
