# MCP Issues 200-202 Delta Specification

## Context

This change records the intended triage boundary for the current MCP issues. It
does not implement the requested product changes. The existing MCP source of
truth remains the normalized local library projected into explicit target
files.

## Requirements

### `FR-MCP-TRIAGE-001`: Separate native Pi MCP from extension compatibility

PromptHub MUST document Pi and Oh My Pi as separate Agent products. A
third-party Pi MCP extension or adapter MUST NOT be represented as native Pi
MCP support unless a verified native contract and target writer exist.

#### Scenario: Pi has no native MCP target

- GIVEN the current Pi Agent separation change has no `mcpRelativePath`
- WHEN MCP target capability is described
- THEN Pi is recorded as unsupported or pending native MCP contract
- AND Oh My Pi's existing target is not used as a Pi alias

#### Scenario: Pi adapter is evaluated later

- GIVEN `pi-mcp-adapter` reads multiple host and project configuration paths
- WHEN PromptHub evaluates compatibility
- THEN the adapter is recorded as extension-owned input
- AND its precedence, discovery mode, write behavior, and package execution
  risk are reviewed before any integration

### `FR-MCP-TRIAGE-002`: Define the MCP header and environment security gate

PromptHub MUST document the distinction between the current raw local MCP
value model and a future agent-specific reference model.

#### Scenario: Existing literal value behavior

- GIVEN a local MCP server has `env` or `headers` values
- WHEN the current v1 behavior is described
- THEN the values are documented as local server configuration projected to
  selected targets
- AND the documentation does not claim encryption, keychain storage, or
  universal runtime expansion

#### Scenario: Future reference syntax support

- GIVEN different agents use different environment or command reference forms
- WHEN a future implementation is planned
- THEN the design MUST define a value kind, target capability matrix,
  unresolved-variable behavior, redaction boundary, and migration path
- AND raw values MUST NOT be returned in previews, logs, sync summaries, or
  other renderer-facing diagnostics

### `FR-MCP-TRIAGE-003`: Make Project MCP a first-class library distribution

PromptHub MUST treat project/workspace MCP targets as first-class distribution
surfaces when they are registered and writable.

#### Scenario: Project target exists

- GIVEN a registered project has a supported project MCP target
- WHEN a user chooses Add from My MCP or applies a server to that target
- THEN the existing workspace binding and target writer are used
- AND unrelated target configuration remains unchanged

#### Scenario: Library detail shows distribution

- GIVEN a server is bound to both global and project targets
- WHEN the My MCP detail, count, or batch distribution view is rendered
- THEN project bindings are included in the target scope and counts
- AND the UI does not imply that only global Agent targets are available

### `FR-MCP-TRIAGE-004`: Keep public issue state separate from local delivery

PromptHub MUST keep the remote GitHub state, local triage state, and product
implementation state in separate records.

#### Scenario: Issue analyzed but not implemented

- GIVEN #200, #201, or #202 has a documented current-state analysis
- WHEN no product implementation has shipped for that issue
- THEN the GitHub issue remains open
- AND the local overlay uses `accepted` or another accurate non-complete state

## Non-functional requirements

### `NFR-MCP-TRIAGE-001`: No secret disclosure in documentation

The records MUST describe secret-bearing fields without including user values,
tokens, cookies, or credentials.

### `NFR-MCP-TRIAGE-002`: Traceable evidence

Every issue conclusion MUST link to the relevant repository source, stable
document, active change, or upstream reference. Unverified future behavior MUST
be labeled `[待确认]` or `planned`.

## Acceptance criteria

- AC-MCP-TRIAGE-001: The current Pi/Oh My Pi distinction is explicit in the
  change record and stable Agent platform reference.
- AC-MCP-TRIAGE-002: The #202 security conflict with the historical MCP v1
  plaintext-value decision is recorded as a future design gate.
- AC-MCP-TRIAGE-003: The #200 project-target gap names the existing workspace
  apply path and the missing library-level projection/count behavior.
- AC-MCP-TRIAGE-004: The repository snapshot contains all current open issues
  returned by the 2026-08-06 GitHub CLI refresh.
- AC-MCP-TRIAGE-005: The local overlay does not mark any of #200, #201, or
  #202 as locally complete.

## Traceability

| Requirement | Acceptance | Design | Verification | Task |
| --- | --- | --- | --- | --- |
| FR-MCP-TRIAGE-001 | AC-MCP-TRIAGE-001 | DES-MCP-TRIAGE-001, DES-MCP-TRIAGE-002 | TEST-MCP-TRIAGE-001, TEST-MCP-TRIAGE-002 | T-MCP-TRIAGE-001, T-MCP-TRIAGE-002 |
| FR-MCP-TRIAGE-002 | AC-MCP-TRIAGE-002 | DES-MCP-TRIAGE-003, DES-MCP-TRIAGE-004 | TEST-MCP-TRIAGE-003, TEST-MCP-TRIAGE-004 | T-MCP-TRIAGE-003, T-MCP-TRIAGE-004 |
| FR-MCP-TRIAGE-003 | AC-MCP-TRIAGE-003 | DES-MCP-TRIAGE-005 | TEST-MCP-TRIAGE-005, TEST-MCP-TRIAGE-006 | T-MCP-TRIAGE-005 |
| FR-MCP-TRIAGE-004 | AC-MCP-TRIAGE-004, AC-MCP-TRIAGE-005 | DES-MCP-TRIAGE-006 | TEST-MCP-TRIAGE-007 | T-MCP-TRIAGE-006 |
| NFR-MCP-TRIAGE-001 | AC-MCP-TRIAGE-002 | DES-MCP-TRIAGE-004 | TEST-MCP-TRIAGE-004 | T-MCP-TRIAGE-004 |
| NFR-MCP-TRIAGE-002 | AC-MCP-TRIAGE-001, AC-MCP-TRIAGE-002, AC-MCP-TRIAGE-003, AC-MCP-TRIAGE-004, AC-MCP-TRIAGE-005 | DES-MCP-TRIAGE-001, DES-MCP-TRIAGE-002, DES-MCP-TRIAGE-003, DES-MCP-TRIAGE-004, DES-MCP-TRIAGE-005, DES-MCP-TRIAGE-006 | TEST-MCP-TRIAGE-001, TEST-MCP-TRIAGE-002, TEST-MCP-TRIAGE-003, TEST-MCP-TRIAGE-004, TEST-MCP-TRIAGE-005, TEST-MCP-TRIAGE-006, TEST-MCP-TRIAGE-007 | T-MCP-TRIAGE-001, T-MCP-TRIAGE-002, T-MCP-TRIAGE-003, T-MCP-TRIAGE-004, T-MCP-TRIAGE-005, T-MCP-TRIAGE-006 |

## Deferred decisions

- `[待确认]` Whether PromptHub should import Pi host config files as a
  read-only compatibility source or only support explicit Pi package exports.
- `[待确认]` Whether the future MCP secret value model uses environment
  references, an OS keychain, encrypted local storage, or a combination.
- `[待确认]` Whether Project MCP counts should include all registered targets
  or only targets with an existing binding.
