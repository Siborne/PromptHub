# Agent Rules Source Matrix Design

<!-- traceability: enforced -->

## `DES-RULESRC-001`: Registry And Adapter Boundary

Add lightweight source declarations to `packages/shared`; put path resolution,
parsing, traversal, fingerprinting, and reconciliation in `packages/core` or
the existing desktop main Rules service until that workflow is extracted.
Renderer code consumes typed records and never probes arbitrary paths.

The registry separates `single-file` and `directory` adapters. A directory
entry derives a stable identity from platform, scope, canonical root, and safe
relative path. Content hashes are comparison data, not identity.

## `DES-RULESRC-002`: Managed Record Model

Extend managed Rule metadata with source platform, source scope, adapter id,
relative path, format, external fingerprint, and sync status. Managed content
and versions remain under `data/rules`; RuleDB remains an index/cache. A rescan
updates records in one batch and reuses #193's `target-missing` semantics.

## `DES-RULESRC-003`: Scan Algorithm

For `S` enabled source roots and `F` admitted files, scanning is `O(S + F)` and
uses a path-keyed map for reconciliation. Directory walking is iterative,
depth/file/byte limited, does not follow symlinks, filters extensions before
reading content, and commits changed metadata in a transaction/batch. Unchanged
mtime/size plus stored digest may skip content hashing only when the adapter's
filesystem policy makes that cache safe.

## `DES-RULESRC-004`: Capability States

Matrix rows are `supported`, `experimental`, `documented`, or `unsupported`.
Only supported rows scan by default. Experimental rows require user opt-in and
show version evidence. Unsupported rows cannot be enabled by editing settings.

## `DES-RULESRC-005`: Canonical Entry Projection

The existing `SkillPlatform.globalRuleFile` remains the single source for the
Agent summary path and Rules capability. Kiro, Augment, and Cline receive one
verified relative entry path each. Matching entries are added to
`KNOWN_RULE_FILE_TEMPLATES`, so descriptor listing, safe path resolution,
missing-file confirmation, save, versioning, conflict handling, and WebDAV sync
continue through the existing Rules service without renderer path construction
or a new IPC contract.

Kiro and Cline entries live inside richer rules directories. Their descriptor
copy identifies the entry as one global file and does not imply that sibling
files are inventoried. Augment uses its documented single user-guidelines file.
Directory inventory remains governed by `DES-RULESRC-001` through
`DES-RULESRC-004` and is not silently approximated.

The change adds three constant registry rows. Descriptor construction remains
`O(P)` for the bounded platform count, while read/create/save remain one-file
`O(B)` operations for content size `B`; no directory traversal or extra network
request is introduced.

## Failure And Rollback

- An unreadable root reports a source-level warning and preserves managed data.
- Partial scan failure does not mark unseen files missing until that root
  completed successfully.
- Disabling/removing a row never deletes external files.
- Stable single-file Rules remain readable throughout migration.

## Analyze Result

- This intentionally replaces the stable single-file-only runtime boundary;
  the user's #197 request authorizes the design expansion.
- Exact platform rows remain implementation-gated on official documentation or
  executable fixtures; Claude is the first mandatory supported adapter.

## Traceability

| Requirement       | Design                               | Verification                           | Task            |
| ----------------- | ------------------------------------ | -------------------------------------- | --------------- |
| `FR-RULESRC-001`  | `DES-RULESRC-001`, `DES-RULESRC-004` | `TEST-RULESRC-001`                     | `T-RULESRC-002` |
| `FR-RULESRC-002`  | `DES-RULESRC-001`, `DES-RULESRC-003` | `TEST-RULESRC-002`                     | `T-RULESRC-003` |
| `FR-RULESRC-003`  | `DES-RULESRC-002`, `DES-RULESRC-003` | `TEST-RULESRC-002`                     | `T-RULESRC-004` |
| `FR-RULESRC-004`  | `DES-RULESRC-001`, `DES-RULESRC-004` | `TEST-RULESRC-003`                     | `T-RULESRC-005` |
| `NFR-RULESRC-001` | `DES-RULESRC-003`                    | `TEST-RULESRC-003`, `TEST-RULESRC-004` | `T-RULESRC-006` |
| `FR-RULESRC-005`  | `DES-RULESRC-005`                    | `TEST-RULESRC-005`                     | `T-RULESRC-008` |
