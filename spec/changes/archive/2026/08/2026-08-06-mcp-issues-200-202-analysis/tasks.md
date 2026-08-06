# MCP Issues 200-202 Analysis Tasks

## Current change tasks

- [x] `T-MCP-TRIAGE-001` Capture the current open GitHub issue list and verify
  the issue bodies for #200, #201, and #202.
- [x] `T-MCP-TRIAGE-002` Compare Pi, Oh My Pi, and Project MCP behavior against
  the current registry, target preset, library, and active change documents.
- [x] `T-MCP-TRIAGE-003` Record the current raw env/header model and the
  security, compatibility, migration, and redaction gates for #202.
- [x] `T-MCP-TRIAGE-004` Write the delta spec and complete the
  `FR -> DES -> TEST -> T` traceability table.
- [x] `T-MCP-TRIAGE-005` Sync `agent-platforms.md` and the local GitHub overlay
  without claiming unimplemented product behavior.
- [x] `T-MCP-TRIAGE-006` Refresh the repository-level open GitHub snapshot from
  `gh issue list`.
- [x] `T-MCP-TRIAGE-007` Run focused MCP regression tests and documentation
  governance checks.
- [x] `T-MCP-TRIAGE-008` Complete converge review and archive this documentation
  change.

## Verification mapping

- `TEST-MCP-TRIAGE-001`: stable docs and active `pi-agent-separation` agree that
  Pi has no native MCP target.
- `TEST-MCP-TRIAGE-002`: `pi-mcp-adapter` and Oh My Pi references are linked,
  and third-party extension behavior is not represented as native support.
- `TEST-MCP-TRIAGE-003`: current shared MCP types and serializer paths show
  raw `env`/`headers` values and `${VAR}` static reference handling.
- `TEST-MCP-TRIAGE-004`: no document contains a real secret; the future #202
  gate names redaction, persistence, migration, and failure recovery.
- `TEST-MCP-TRIAGE-005`: existing Project MCP target actions and workspace
  binding path are recorded; the global-only library count/detail gap is
  recorded as a follow-up, not as shipped behavior.
- `TEST-MCP-TRIAGE-006`: the 2026-08-06 snapshot contains all 34 open issues
  returned by the GitHub CLI refresh.
- `TEST-MCP-TRIAGE-007`: the local overlay keeps #200, #201, and #202 open with
  `accepted` state.

## Deferred implementation backlog

These are handoff items, not unchecked tasks for this documentation change:

- `F-MCP-200`: add shared global/project scope state to My MCP detail, count,
  and batch distribution surfaces; add a regression test for mixed scope
  bindings.
- `F-MCP-201`: decide whether to support a read-only Pi adapter import or keep
  Pi MCP package-owned; if supported, add precedence and discovery fixtures
  before any writer.
- `F-MCP-202`: define and implement the secret/reference value contract only
  after confirming source of truth, redaction, migration, export/backup, and
  target compatibility decisions.
