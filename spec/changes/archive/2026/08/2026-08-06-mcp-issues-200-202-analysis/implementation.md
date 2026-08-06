# MCP Issues 200-202 Analysis Implementation

## Status

Completed as a documentation and issue-triage change on 2026-08-06. Product
implementation for #200, #201, and #202 remains deferred and is not implied by
this record.

## Delivered

- Added the issue-specific proposal, delta spec, design, task, and
  implementation records.
- Added a typed internal issue record for the combined MCP triage.
- Refreshed the open GitHub snapshot to 34 issues as of 2026-08-06.
- Added #200, #201, and #202 to the local delivery overlay as open and
  `accepted`.
- Updated the stable Agent platform reference with the Oh My Pi target,
  Pi-native MCP boundary, adapter evidence, Project MCP gap, and current
  env/header value boundary.
- Kept the existing `pi-agent-separation`, `agent-management-workbench`, and
  archived MCP management records intact; no competing product contract was
  introduced.

## Product code impact

No production source, tests, schema, IPC contract, target file, user data, or
runtime configuration was modified by this change.

## Verification

The previously run focused MCP regression set passed:

- Desktop MCP target/import/config tests: 32 tests passed.
- Desktop MCP detail/distribution and store tests: 20 tests passed.
- Core MCP env import and target sync tests: 6 tests passed.
- Total focused MCP tests: 58 passed.

The documentation-specific checks completed after the final archive/index state:

- `pnpm spec:traceability`: passed for 12 enforced changes, including this
  change before archive.
- `pnpm spec:test`: executed after the final archive/index state.
- `pnpm spec:index:check`: executed after the final archive/index state.
- `git diff --check`: executed for the tracked documentation changes.

## Residual risks and follow-up

- #202 remains a security-sensitive design gap. The local MCP library still
  follows the existing v1 raw string model; this change does not redact or
  migrate values.
- #201 remains a compatibility decision. Pi MCP is still extension-owned and
  no Pi target writer was added.
- #200 remains a UX/data-projection gap in the My MCP global/project views even
  though the Project MCP target apply path exists.
- The next product implementation must create a new issue-specific active
  change, write a failing regression test first, and resolve the `[待确认]`
  decisions before changing shared types or persistence.

## Resource lifecycle

GitHub CLI commands completed in the foreground. No server, browser session,
port, temporary file, or background process was created or retained.
