# Storage Recovery Review Fixes Design

<!-- traceability: enforced -->

## `DES-STOREREC-001`: Exact journal ownership

Both restore operation paths are derived from `activeRoot + operationId` and
must match exactly. Operation and artifact IDs reject `.` and `..` in addition
to path separators. Journal and registry paths validate every existing ancestor
below the owning root before writes. Root containment remains a defense in depth
check.

## `DES-STOREREC-002`: Artifact publication state machine

Artifact publication first creates a private operation-owned directory with a
`preparing` manifest, moves the prior tree to `root/`, then atomically replaces
the manifest with `complete`. Recovery recognizes an owned `preparing` artifact
and finishes it. Unrecognized collisions remain fail-closed.

## `DES-STOREREC-003`: Bounded scans and invalid artifact cleanup

Root journals record whether secrets participated in the source digest.
Inventory counts every visited node. Registry scans return valid and invalid
owned entries separately so retention can remove invalid ordinary directories
without following symlinks; an unsafe registry root remains untouched.

## Affected Areas

- Data model: additive root-journal `includeSecrets` field; backward-compatible
  default is `true`, matching historical root operations.
- Filesystem: operation journals and recovery artifact manifests.
- IPC / API: none.
- UI / UX: none.

## Failure And Rollback

- Manifest publication failure leaves a recoverable `preparing` artifact and
  journal instead of attempting a destructive rollback without the prior tree.
- Invalid artifact cleanup removes only a direct, non-symlink child of the
  managed registry root.

## Analyze Result

- Requirement links: complete.
- Verification links: complete.
- Blocking conflicts: none; this tightens the archived storage design.
- Unresolved `[待确认]`: none.

## Traceability

| Requirement       | Design             | Verification        | Task             |
| ----------------- | ------------------ | ------------------- | ---------------- |
| `FR-STOREREC-001` | `DES-STOREREC-001` | `TEST-STOREREC-001` | `T-STOREREC-001` |
| `FR-STOREREC-002` | `DES-STOREREC-002` | `TEST-STOREREC-002` | `T-STOREREC-002` |
| `FR-STOREREC-003` | `DES-STOREREC-003` | `TEST-STOREREC-003` | `T-STOREREC-003` |
