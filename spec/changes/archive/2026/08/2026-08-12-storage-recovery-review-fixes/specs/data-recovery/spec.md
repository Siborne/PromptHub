# Spec Delta: Storage Recovery Review Fixes

## Added Requirements

### `FR-STOREREC-001`: Operation-owned recovery paths

PromptHub MUST accept a restore journal only when its stage and prior paths are
the exact paths derived from the journal operation identity. Operation and
artifact identities MUST be safe single path segments and MUST reject `.` and
`..`. Existing path components from the owning root to journals and artifacts
MUST reject symbolic links before reads, writes, or cleanup.

#### Scenario: A journal names another managed directory

- **GIVEN** a syntactically valid journal whose stage or prior path names active
  data, configuration, or another operation's directory
- **WHEN** startup recovery reads the journal
- **THEN** recovery fails closed before deleting or renaming that path.

### `FR-STOREREC-002`: Resumable recovery artifact publication

PromptHub MUST preserve and recover a prior set when interruption occurs between
moving it into the registry and publishing the complete artifact manifest.

### `FR-STOREREC-003`: Consistent bounded inventory and retention

PromptHub MUST preserve the inventory secret-inclusion policy in its journal,
count files and directories against traversal limits, and account for or safely
remove invalid managed artifact directories during retention.

## Modified Requirements

- `FR-DATA-003`, `FR-DATA-006`, and `FR-DATA-008` retain their existing
  externally observable guarantees and gain adversarial crash-window coverage.

## Removed Requirements

- None.

## Verification

- `TEST-STOREREC-001`: malformed operation-owned path fixtures prove no active
  data is touched.
- `TEST-STOREREC-002`: injected failures around prior move and manifest publish
  prove restart completion preserves both current and prior data.
- `TEST-STOREREC-003`: secret-bearing rename recovery, empty-directory stress,
  and malformed/oversized artifact retention fixtures prove bounded behavior.
