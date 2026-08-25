# ISS-20260825-009: Deleted Agent session returns after restart

- Status: resolved locally
- Severity: high
- Owner: `agent-management-workbench`
- Verification: `E2E-AGENT-010`

## Phenomenon

Deleting a Claude session removed its native JSONL file and immediately removed
the row from the Agent Sessions UI. Relaunching Electron with the same profile
showed the deleted row again. Opening it displayed `Failed to read this session.`

## Root Cause

`createAgentSessionIndexService().delete()` delegated only to the native session
reader. When local session indexing was enabled, the matching
`agent_session_index` row stayed `present`, so the next launch projected stale
metadata instead of the now-empty native source.

## Resolution

After a successful native deletion, remove the exact `(source_id, external_id)`
row from the rebuildable local index. Native deletion remains first so a failed
native operation cannot hide an existing session from the index.

## Verification

- Database coverage asserts exact-row deletion, sibling preservation, repeat
  deletion, and malformed identity rejection.
- Service coverage asserts both index-disabled and index-enabled deletion.
- Real Electron coverage asserts the native file is absent immediately and the
  deleted session remains absent after restart.
