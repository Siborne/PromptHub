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

## Known Gap

The standalone CLI still lacks first-class remote sync commands for self-hosted/cloud push and pull. This change only aligns the file-based local workspace snapshot contract and Cloudflare storage preservation.
