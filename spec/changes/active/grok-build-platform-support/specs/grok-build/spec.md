# Grok Build Platform Delta Spec

## Added Requirements

### Requirement: PromptHub must recognize Grok Build as a built-in platform

PromptHub must provide a built-in `grok` platform representing xAI Grok Build.
It must use the documented `~/.grok` root on macOS/Linux and
`%USERPROFILE%\\.grok` on Windows, with `skills`, `plugins`, `agents`,
`commands`, global `AGENTS.md`, and the `config.toml`, `pager.toml`,
`settings.json`, `lsp.json`, and `sandbox.toml` configuration previews as
supported user-level asset surfaces.

#### Scenario: User distributes a Skill to Grok Build

- Given Grok Build is enabled as a PromptHub platform
- When the user installs a Skill to Grok Build
- Then PromptHub writes the package under the resolved `skills/<skill-name>` directory
- And the platform remains visible when its root is explicitly configured, even before Grok Build has created it.

### Requirement: PromptHub must not misrepresent Grok Build MCP compatibility

PromptHub must record Grok Build's user-level `config.toml` MCP contract, but
must not expose it as an MCP distribution target until its TOML adapter writes
the documented `headers` field for remote transports.

#### Scenario: User views Grok Build platform assets

- Given Grok Build is enabled as a PromptHub platform
- When the user views its platform configuration
- Then PromptHub shows `config.toml`, `pager.toml`, `settings.json`, `lsp.json`, and `sandbox.toml` as documented configuration files
- And the derived MCP configuration path is `~/.grok/config.toml`
- And it does not offer a Grok MCP distribution target backed by the incompatible Codex TOML serializer.

#### Scenario: User views Grok Build global rules

- Given Grok Build is enabled as a PromptHub platform
- When the user views its rule candidates
- Then PromptHub resolves the global rule file to `~/.grok/AGENTS.md`
- And project-scoped instruction files remain owned by their repository directories.

### Requirement: PromptHub must not advertise incomplete Grok Plugin distribution

PromptHub may discover the official `~/.grok/plugins/` directory, but it must
not advertise Grok as a Plugin bundle distribution target until the Plugin
target matrix, manifest adapter, installed-package scanner, and target-path
resolver all support Grok.
