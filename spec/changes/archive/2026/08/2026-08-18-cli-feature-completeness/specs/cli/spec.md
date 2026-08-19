# CLI Spec Delta

## FR-CLI-001 Workspace snapshot completeness

### Requirement

CLI `workspace export` / `sync push` payloads MUST include skill package files when local repos exist, and MUST include prompt relations and output-format items when present.

### Scenario: export portable skill files

- **GIVEN** a skill with managed local repo files
- **WHEN** the user runs `prompthub workspace export --file bundle.json`
- **THEN** `payload.skillFiles[<skillId>]` contains the package file snapshots

### Scenario: import restores skill files

- **GIVEN** a v2 bundle with `skillFiles`
- **WHEN** the user imports with `--force-clear` into an empty data dir
- **THEN** skill DB rows and managed repo files are restored

### Scenario: force-clear removes relation and output-format rows

- **GIVEN** local prompt relations and output-format items
- **WHEN** workspace import uses `--force-clear`
- **THEN** those tables are emptied before restore

## FR-CLI-002 MCP write commands

### Requirement

CLI MUST support creating, updating, and deleting MCP library servers without requiring a market template file.

### Scenario: create and delete MCP server

- **GIVEN** a local data dir
- **WHEN** the user creates an MCP server then deletes it by id/name
- **THEN** the MCP library no longer contains that server

## FR-CLI-003 Plugin resource

### Requirement

CLI MUST expose Plugin library list/get/market/install/delete/versions operations against the shared Plugin library.

## FR-CLI-004 Prompt graph and formats

### Requirement

CLI MUST allow setting prompt `parentId`, managing prompt relations, and managing output-format sequences.

## FR-CLI-005 Skill metadata and source check

### Requirement

CLI MUST support skill metadata updates and a source/local fingerprint check-update report.

## NFR-CLI-001 CLI module boundaries

### Requirement

CLI command routing, command-domain helpers, and tests MUST remain separated by
responsibility. No source or test module introduced by this change may exceed
the 1000-line default limit, and command modules MUST NOT depend on `run.ts`
or a cross-domain utility barrel for shared types or helpers.

## TEST-CLI-001

Cover FR-CLI-001..005 with Vitest cases under `apps/cli/tests`.

## TEST-CLI-002

Verify NFR-CLI-001 with Core and CLI typechecks, the CLI Vitest suite, and
line-count review of changed CLI source and test modules.
