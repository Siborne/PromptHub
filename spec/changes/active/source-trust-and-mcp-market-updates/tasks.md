# Tasks

- [x] `T-TRUST-001` Add readable trusted Skill source presentation and regression coverage. Covers `FR-TRUST-001`, `DES-TRUST-001`, `TEST-TRUST-001`.
- [x] `T-MCP-MARKET-001` Add main-process MCP market source persistence, migration IPC, fetch authorization, and SSRF regression coverage. Covers `FR-MCP-MARKET-001`, `DES-MCP-MARKET-001`, `TEST-MCP-MARKET-001`.
- [x] `T-MCP-MARKET-002` Add MCP template provenance, fingerprint reconciliation, explicit update apply, renderer status, and regression coverage. Covers `FR-MCP-MARKET-002`, `DES-MCP-MARKET-002`, `TEST-MCP-MARKET-002`.
- [x] Run focused Skill/MCP tests, full desktop tests, shared/core/desktop type checks, lint, file-size gate, and production build.
- [x] Sync stable Skill/MCP behavior documentation and record final verification.

## Analyze Gate

- Every FR has a DES, TEST, and T mapping.
- Skill authorization identity remains unchanged; only presentation is derived.
- MCP upstream reconciliation and MCP target projection reconciliation remain separate workflows.
- Main-process source registration narrows network authority to persisted sources and does not globally disable SSRF checks.
- No blocking `[待确认]` item remains for implementation.
