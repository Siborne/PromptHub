# Design: Web Workspace Capability Alignment

## Decisions

- `DES-WEB-CORE-001`: `apps/web` owns HTTP validation and authorization;
  `packages/db` continues to own prompt-relation and output-format persistence.
- `DES-WEB-CORE-002`: prompt hierarchy changes use a Web service wrapper around
  the existing `PromptDB.movePrompt` contract, followed by workspace sync.
- `DES-WEB-CORE-003`: the Web bridge maps advanced Prompt methods to REST but
  never falls back to browser IndexedDB for server-owned records.
- `DES-WEB-CORE-004`: browser module visibility is resolved by a small shared
  renderer helper so Desktop behavior remains unchanged while Web omits MCP and
  Plugin modules.
- `DES-WEB-CORE-005`: MCP and Plugin data remains an opaque sync/backup
  snapshot in Web; browser management is intentionally excluded because target
  config mutation and package filesystem operations are Desktop-owned.

## Data And Recovery

- Source of truth for Prompt hierarchy, relations, and output formats is the
  existing SQLite database plus its workspace projection.
- Route failures make no browser-local fallback write. DB mutations occur
  before the workspace projection; existing workspace synchronization is the
  recovery boundary used by other Web Prompt mutations.
- No schema migration is required because the existing tables and types are
  reused.

## Verification Methods

- Black-box Web route tests with real SQLite fixtures and visibility checks.
- Bridge contract tests for durable URL and method mapping.
- Renderer helper unit tests for Desktop and Web module selection.
- Existing snapshot tests for agent asset preservation.
- Browser operation check for Prompt hierarchy/relation/output-format workflows.

## Traceability

| Requirement | Design | Verification | Task |
| --- | --- | --- | --- |
| `FR-WEB-CORE-001` | `DES-WEB-CORE-001/002/003` | `TEST-WEB-CORE-001/002` | `T-WEB-CORE-001/002` |
| `FR-WEB-CORE-002` | `DES-WEB-CORE-004/005` | `TEST-WEB-CORE-003` | `T-WEB-CORE-003` |
| `FR-WEB-CORE-003` | `DES-WEB-CORE-005` | `TEST-WEB-CORE-004` | `T-WEB-CORE-004` |
| `NFR-WEB-CORE-001` | `DES-WEB-CORE-001/002` | `TEST-WEB-CORE-001` | `T-WEB-CORE-001` |
