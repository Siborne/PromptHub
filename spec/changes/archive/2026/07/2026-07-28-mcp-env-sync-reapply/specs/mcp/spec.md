# MCP Env Sync Reapply Delta Spec

## Added Requirements

### Requirement: MCP Server Distribution Reconciliation

PromptHub MUST be able to reconcile a local MCP server record against every target where PromptHub previously distributed that server.

#### Scenario: Distributed target remains in sync

- **GIVEN** an MCP server was previously applied to a target config
- **AND** the local MCP server record has not changed since that apply
- **AND** the target config entry still matches PromptHub's projected entry
- **WHEN** PromptHub checks distribution status
- **THEN** the target status is `synced`

#### Scenario: PromptHub MCP server changed after distribution

- **GIVEN** an MCP server was previously applied to one or more target configs
- **WHEN** the user edits a projected field such as `command`, `args`, `cwd`, `env`, `url`, `headers`, `transport`, or `enabled`
- **THEN** PromptHub MUST mark the affected distributed targets as needing sync
- **AND** the status MUST explain that the local MCP server changed after the last apply

#### Scenario: Target config changed externally

- **GIVEN** an MCP server was previously applied to a target config
- **AND** the current target config entry no longer matches the last PromptHub-applied projection
- **AND** the local MCP server record still matches the last PromptHub-applied projection
- **WHEN** PromptHub checks distribution status
- **THEN** the target status is externally modified
- **AND** one-click sync MUST NOT overwrite it silently

#### Scenario: Both local server and target config changed

- **GIVEN** an MCP server was previously applied to a target config
- **AND** the local MCP server record changed after the last apply
- **AND** the target config entry also changed externally after the last apply
- **WHEN** PromptHub checks distribution status
- **THEN** the target status is conflicted
- **AND** PromptHub MUST require explicit user confirmation before overwriting the target entry

#### Scenario: Legacy binding without baseline metadata

- **GIVEN** an existing MCP target binding does not contain per-server apply baseline metadata
- **WHEN** PromptHub checks distribution status
- **AND** the current target entry matches the current projected local server entry
- **THEN** PromptHub MUST treat the target as `synced`
- **AND** it MUST backfill the current projected entry digest as the baseline without rewriting the target file
- **WHEN** the current target entry does not match the current projected local server entry
- **THEN** PromptHub MUST mark the target as `legacy-needs-review` rather than silently overwriting

#### Scenario: Target config cannot be parsed

- **GIVEN** a target file exists
- **AND** its JSON, JSONC, or TOML content cannot be parsed into MCP entries
- **WHEN** PromptHub checks distribution status
- **THEN** the target status is `parse-error`
- **AND** one-click sync MUST skip the target unless the user explicitly repairs or overwrites it

#### Scenario: Disabled MCP server has historical bindings

- **GIVEN** an MCP server is disabled in PromptHub
- **AND** it has historical target bindings
- **WHEN** PromptHub checks or syncs distributed targets
- **THEN** PromptHub MUST mark those bindings as `skipped-server-disabled`
- **AND** one-click sync MUST NOT call apply for that server
- **AND** PromptHub MUST NOT automatically remove the server entry from target files

### Requirement: One-Click Reapply To Distributed Targets

PromptHub MUST provide a user action to reapply one MCP server to all targets where that server was previously distributed.

#### Scenario: Sync all previously distributed targets

- **GIVEN** a user edits `MINERU_TOKEN` or another MCP env value on a saved MCP server
- **AND** that server was previously distributed to multiple agent targets
- **WHEN** the user clicks "Sync distributed targets"
- **THEN** PromptHub reapplies the current MCP server projection to each safe target
- **AND** each successful write creates a backup and uses the existing atomic write path
- **AND** the target binding baseline is updated after each successful write

#### Scenario: Sync only safe stale targets

- **GIVEN** some distributed targets are stale because the local MCP server changed
- **AND** other targets are externally modified or conflicted
- **WHEN** the user chooses the default one-click sync action
- **THEN** PromptHub SHOULD sync the safe stale targets
- **AND** it MUST skip or block externally modified/conflicted targets unless the user explicitly confirms overwrite

#### Scenario: Sync one Codex server without deleting other managed servers

- **GIVEN** PromptHub previously distributed MCP server A and MCP server B to the same Codex TOML target
- **WHEN** the user syncs only MCP server A
- **THEN** the target config MUST retain MCP server B
- **AND** PromptHub MUST NOT replace the whole Codex managed block with only server A
- **AND** any baseline metadata updated by the write MUST remain correct for both managed servers

#### Scenario: Target no longer exists

- **GIVEN** a binding records that an MCP server was distributed to a target path
- **AND** the target file no longer exists
- **WHEN** PromptHub checks or syncs distributed targets
- **THEN** the target status MUST report the target as missing
- **AND** one-click sync MAY recreate the target file only if the user explicitly chooses to reapply to that target

#### Scenario: Platform disabled in settings

- **GIVEN** a target binding exists for a platform disabled in Settings
- **WHEN** PromptHub builds the sync-all target list
- **THEN** the disabled platform MUST be skipped by default
- **AND** the UI MUST explain that it is hidden by platform settings

### Requirement: MCP Env Value Semantics

PromptHub MUST treat MCP env values saved on the local MCP server record as the default source of truth for distributed target configs.

#### Scenario: Literal env value distribution

- **GIVEN** an MCP server has `env.MINERU_TOKEN` set to an actual token value
- **WHEN** the server is applied or re-applied to agent targets
- **THEN** PromptHub writes that literal env value into each target's MCP config shape
- **AND** PromptHub does not mutate the operating system environment

#### Scenario: Variable reference entered as env value

- **GIVEN** a user enters `${MINERU_TOKEN}` as an MCP env value
- **WHEN** PromptHub saves or checks that MCP server
- **THEN** PromptHub MUST preserve the string exactly
- **AND** PromptHub MUST report an `UNRESOLVED_ENV_REFERENCE` static warning that many agent targets do not expand config-file environment references
- **AND** PromptHub MUST NOT claim the target authentication is valid only because the placeholder-like reference is non-empty

#### Scenario: Variable reference in args, URL, or headers

- **GIVEN** an MCP server uses `${MINERU_TOKEN}` in `args`, `url`, or `headers`
- **WHEN** PromptHub runs static health checks
- **THEN** PromptHub MUST report it as a required environment reference unless the value has been resolved by explicit user input
- **AND** the static check copy MUST clarify that PromptHub did not run a live provider authentication check

### Requirement: Distribution Status UI

PromptHub MUST expose distribution sync state where users manage MCP servers.

#### Scenario: MCP detail shows distributed target health

- **GIVEN** a saved MCP server has target bindings
- **WHEN** the user opens the MCP detail page
- **THEN** PromptHub shows how many targets are synced, stale, externally modified, conflicted, missing, or skipped
- **AND** the detail page provides a "Sync distributed targets" action when at least one safe stale target exists

#### Scenario: User reviews sync result

- **GIVEN** the user runs one-click sync
- **WHEN** the operation completes
- **THEN** PromptHub shows which targets were updated, skipped, blocked, or failed
- **AND** the result includes backup paths for updated targets where available
- **AND** the sync result MUST NOT include full target config content, MCP env values, headers, or token-bearing arguments

## Non-Requirements

- PromptHub v1 does not provide a global secret vault or keychain-backed MCP secret store.
- PromptHub v1 does not automatically export secrets into shell profiles, launch agents, or OS-level environment stores.
- PromptHub v1 does not live-test a third-party MCP server's provider credentials.
- PromptHub v1 does not auto-sync on every edit without a user action.
- PromptHub v1 does not treat disabling a local MCP server as an automatic uninstall/remove operation on previously distributed targets.

## Traceability

| Requirement | Design | Verification | Task |
| --- | --- | --- | --- |
| MCP Server Distribution Reconciliation | DES-MCP-SYNC-001, DES-MCP-SYNC-002 | TEST-MCP-SYNC-001, TEST-MCP-SYNC-002 | T-MCP-SYNC-001, T-MCP-SYNC-002 |
| One-Click Reapply To Distributed Targets | DES-MCP-SYNC-003, DES-MCP-SYNC-004 | TEST-MCP-SYNC-003, TEST-MCP-SYNC-004 | T-MCP-SYNC-003, T-MCP-SYNC-004 |
| MCP Env Value Semantics | DES-MCP-SYNC-005 | TEST-MCP-SYNC-005, TEST-MCP-SYNC-006 | T-MCP-SYNC-005 |
| Distribution Status UI | DES-MCP-SYNC-006 | TEST-MCP-SYNC-007 | T-MCP-SYNC-006 |
