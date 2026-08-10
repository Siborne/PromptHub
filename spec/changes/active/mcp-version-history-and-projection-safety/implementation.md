# Implementation

## Status

- Phase: implement
- Status: in-progress
- Completed scope: external target projection safety and `backupPath`
  deprecation
- Remaining scope: My MCP version history, conflict workflows, legacy-sidecar
  cleanup, product surfaces, and convergence

## Implemented In This Iteration

- Replaced adjacent `.prompthub-mcp-backup-*` creation in apply, remove, and
  managed-target synchronization with one shared projection commit boundary.
- Added byte-identical no-op detection so repeated distribution does not change
  target inode or modification time.
- Added same-directory temporary publication, file flush, atomic rename,
  post-write byte and MCP-entry verification, and exact in-memory rollback.
- Restores the original bytes when verification or binding persistence fails;
  removes a newly created target when the same failure occurs on first write.
- Removes temporary projection files on success and failure. No persistent or
  centralized copy of an external Agent/project config is created.
- Kept the optional `backupPath` fields readable for compatibility, marked them
  deprecated, and omitted them from new projection results.

## Remaining Delivery

- Formal My MCP version history under PromptHub-owned data.
- No persistent backup artifact for external Agent/project MCP projection.
- Atomic projection, in-operation rollback, verification, and crash
  reconciliation.
- Entry-level import/overwrite conflict handling.
- Previewed and confirmed cleanup for legacy PromptHub sidecars.

## Verification Status

- Test-first evidence: the changed Desktop projection tests failed against the
  previous sidecar implementation before production code changed.
- `pnpm --filter @prompthub/core exec vitest run
tests/mcp-target-projection.test.ts --coverage
--coverage.include=src/mcp-target-projection.ts --coverage.reporter=text`:
  9 tests passed; the changed projection helper reached 100% statements,
  branches, functions, and lines.
- Focused Desktop MCP suite: 3 files and 52 tests passed.
- `pnpm --filter @prompthub/core typecheck`: passed.
- `pnpm --filter @prompthub/shared typecheck`: passed.
- UI verification, legacy-sidecar cleanup tests, and performance measurements
  remain pending with the unfinished tasks.

## Convergence Gate

This change must remain active until implementation, adversarial verification,
stable documentation sync, and issue-state reconciliation are complete.
