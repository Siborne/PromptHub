# Local Resource Device Identity Delta

### `FR-LOCALID-001`: Local resources do not require sync identity

PromptHub MUST read and write local Plugin, MCP, and Agent resources when `selfHostedDeviceId` is null or absent.

#### Scenario: Local-only installation

- **Given** canonical file authority is active and no self-hosted synchronization identity exists
- **When** the user opens Plugin, MCP, or Agent management
- **Then** every local library loads normally
- **And** new local projection documents use the deterministic storage-root identity

### `FR-LOCALID-002`: Legacy identities preserve user data

PromptHub MUST accept structurally valid legacy local documents whose embedded device ID differs from the storage-root identity and migrate them without dropping payload data.

#### Scenario: Legacy Agent document

- **Given** `agents.json` contains valid Agent preferences under a legacy UUID device ID
- **When** canonical Agent settings are read
- **Then** the preferences remain intact
- **And** the document is atomically re-keyed to the local storage-root identity

#### Scenario: Legacy MCP binding document

- **Given** `mcp-bindings.json` contains valid bindings under a legacy device ID
- **When** the MCP library is read
- **Then** bindings remain available without consulting renderer sync configuration
- **And** the next canonical write publishes them with the local storage-root identity

### `NFR-LOCALID-001`: Bounded and safe migration

Identity recovery MUST reject malformed, oversized, symlinked, or unsafe documents and MUST not scan or rewrite unrelated resource payloads.
