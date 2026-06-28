# Sync Delta Spec

## Modified Requirements

### Requirement: Sync Snapshot Field Preservation

PromptHub sync-compatible storage endpoints MUST preserve every current `SyncSnapshot` field that is part of the recoverable user-owned data contract.

#### Scenario: Cloudflare stores current agent assets

- **GIVEN** a sync snapshot contains `mcpLibrary`, `pluginLibrary`, `pluginPackages`, `storeSources`, and `agentAssetFiles`
- **WHEN** the Cloudflare sync backend accepts the payload
- **THEN** the stored payload returned by later reads contains the same fields
- **AND** manifest/count summaries expose MCP server and plugin counts.

### Requirement: Summary Shape Includes Agent Assets

PromptHub sync summaries SHOULD include `mcpServers` and `plugins` whenever the snapshot contains My MCP or My Plugin libraries.

#### Scenario: User checks a cloud sync manifest

- **GIVEN** the stored snapshot contains one MCP server and one plugin
- **WHEN** the manifest is requested
- **THEN** the response reports `counts.mcpServers = 1`
- **AND** `counts.plugins = 1`.
