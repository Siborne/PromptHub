# MCP Market Source And Update Delta

## FR-MCP-MARKET-001: Main-Process Source Registration

PromptHub MUST keep the security-relevant MCP market source allowlist in the main process.

### Scenario: Explicit self-hosted source

- **GIVEN** the user registers an HTTP(S) MCP catalog source
- **WHEN** the source is persisted and later fetched
- **THEN** the main process permits requests only for the registered source origin and allowed path
- **AND** explicitly registered private-network HTTP(S) sources may be fetched
- **AND** redirects are revalidated by the existing remote fetch guard

### Scenario: Arbitrary internal URL

- **GIVEN** a renderer requests an unregistered internal URL or a different origin/path
- **WHEN** the MCP fetch IPC validates the request
- **THEN** it rejects the request before network access

## FR-MCP-MARKET-002: Upstream Template Reconciliation

PromptHub MUST track the installed market template baseline for every MCP installed from PromptHub Official Store, a remote registry, or a custom store.

### Scenario: Official or custom template changes

- **GIVEN** an installed MCP has a stable market template identity and baseline fingerprint
- **WHEN** the same template id is loaded with a different source-owned configuration or version
- **THEN** PromptHub reports an update available when the local source-owned fields still match the baseline
- **AND** reports local modification or conflict instead of silently overwriting divergent fields

### Scenario: Apply an MCP market update

- **GIVEN** an upstream update is safely applicable or the user explicitly confirms a conflict
- **WHEN** PromptHub applies the template update
- **THEN** source-owned runtime/configuration fields and the baseline are refreshed
- **AND** enabled state, favorite state, notes, tags, env/header secret values, record identity, target bindings, and target files are preserved
- **AND** existing target digest reconciliation reports that affected distributed targets need re-sync

### Scenario: Legacy installed market entry

- **GIVEN** an existing market-installed MCP has no baseline fingerprint
- **WHEN** it is compared with a current template
- **THEN** an exact match is treated as up to date and may backfill the baseline
- **AND** a difference requires review rather than being reported as a safe update

## Acceptance Mapping

- `FR-MCP-MARKET-001 -> DES-MCP-MARKET-001 -> TEST-MCP-MARKET-001 -> T-MCP-MARKET-001`
- `FR-MCP-MARKET-002 -> DES-MCP-MARKET-002 -> TEST-MCP-MARKET-002 -> T-MCP-MARKET-002`
