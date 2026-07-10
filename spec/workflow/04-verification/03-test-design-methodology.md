# Test Design Methodology

## Selection Methods

Use the smallest combination that can expose the real risk:

- Equivalence classes for valid/invalid input families.
- Boundary values for empty, zero, one, maximum, oversized, and malformed
  inputs.
- State transitions for install/update/delete/sync/conflict/recovery flows.
- Decision tables for multi-guard policies and platform/source matrices.
- Property or fuzz tests for parsers, paths, identities, and serialized data.
- Fault injection at every external write/read boundary.
- Contract tests across shared types, IPC/preload, routes, CLI, and adapters.
- Concurrency-like repeated actions for deduplication and stale-result guards.
- Security cases for traversal, symlink escape, injection, SSRF-like sources,
  secret handling, and tampering.

## Design Record

For each changed risk, document:

```text
Risk -> observable invariant -> fixture/input -> test layer -> expected failure -> rollback/result
```

Coverage percentage cannot replace this risk-to-invariant mapping.
