# Agent Platform Delta Spec

## Added Requirements

### Requirement `FR-AGENT-PLATFORM-001`: Built-in Skill targets

PromptHub MUST expose Kimi Code CLI, Reasonix, and Augment/Auggie as built-in
Skill platforms using their documented user roots and Skill directories.

#### Scenario: Install a Skill to Kimi Code CLI

- Given the user selects Kimi Code CLI
- When a Skill is installed
- Then the package is copied below the resolved `~/.kimi/skills/` directory
- And the config preview includes `config.toml` and `mcp.json`

#### Scenario: Install a Skill to Reasonix or Auggie

- Given the user selects Reasonix or Augment/Auggie
- When a Skill is installed
- Then the package is copied below the resolved platform `skills/` directory
- And runtime state, credentials, rules directories, and caches are untouched

### Requirement `FR-AGENT-PLATFORM-002`: Do not misrepresent unsupported assets

PromptHub MUST NOT expose a Reasonix MCP target writer or a synthetic
single-file global Rules entry unless a compatible adapter and canonical path
are separately verified. Kimi and Augment MCP targets use their verified JSON
`mcpServers` contracts.

#### Scenario: View agent asset preview

- Given the user opens the platform asset preview
- Then documented config paths are shown as discovery/configuration paths
  - And Reasonix `config.toml` is not offered as a generic MCP apply target
  - And Kimi `mcp.json` and Augment `settings.json` use their documented
    top-level `mcpServers` shape when PromptHub applies an MCP target
  - And registered workspace projects expose Augment's
    `.augment/settings.json` target without changing the global path
- And directory-based rules remain outside the single-file Rules registry

### Requirement `FR-AGENT-PLATFORM-003`: Canonical Qwen identity

PromptHub MUST keep `qoder` as the canonical Qwen coding-agent platform id and
MUST NOT introduce a duplicate `qwen` id for the same product.
