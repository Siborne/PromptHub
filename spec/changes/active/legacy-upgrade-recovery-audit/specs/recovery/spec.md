# Spec Delta: Legacy Upgrade Recovery Audit

## Added Requirements

### `FR-LEGACYREC-001`: Tagged reproduction corpus

The release harness MUST generate sanitized fixtures representing the v0.4.7,
v0.4.8, v0.5.1, and v0.5.2 storage and backup boundaries relevant to #89,
#97, and #98. Every fixture MUST declare its source tag, platform, expected
runtime path, artifact kind, schema objects, record counts, content hashes, and
ordered Prompt-version chain.

### `FR-LEGACYREC-002`: Windows legacy-path discovery for #89

When current data resolves to the roaming PromptHub directory and valid legacy
data remains under an allowlisted Windows install `data` directory, PromptHub
MUST expose the legacy location as a recovery candidate. Discovery, preview,
cancellation, and a failed validation MUST NOT create, move, replace, or delete
files in either location. PromptHub MUST NOT select a source only because it is
newer by filesystem modification time.

### `FR-LEGACYREC-003`: Backup and rollback compatibility for #97

PromptHub MUST distinguish a v0.5.1 portable JSON backup from a v0.5.2 automatic
upgrade snapshot and route each through its supported importer or restore
boundary. A valid artifact MUST preserve all supported records after restart.
An unknown, corrupt, partial, oversized, linked, or incompatible artifact MUST
fail before publication and leave the active data unchanged.

### `FR-LEGACYREC-004`: Complete Prompt history for #98

A legacy Prompt containing at least four monotonically numbered versions MUST
retain every version after import or migration and application restart. Database,
IPC, and history UI observations MUST agree on the complete ordered chain.
Rollback to an intermediate version MUST resolve the requested version rather
than silently substituting the oldest or latest record.

### `FR-LEGACYREC-005`: Evidence-gated remediation

Production code MUST change only for an invariant that fails against a tagged
fixture on the current branch. A passing fixture records the issue as verified
against the tested matrix but does not prove every reporter environment is fixed.
A failing fixture MUST identify the owning boundary and receive the smallest
independently reversible fix.

### `NFR-LEGACYREC-001`: Bounded audit resources

Candidate roots MUST come from a fixed allowlist. Inspection MUST apply explicit
limits for candidate count, traversal depth, entry count, database/artifact size,
temporary disk, and concurrent work. It MUST NOT recursively scan a user's home
directory or load a complete database or media archive into memory.

## Acceptance And Verification

- `TEST-LEGACYREC-089`: reproduce the v0.4.7/v0.4.8 Windows path transition
  with legacy data under `LocalAppData\\Programs\\PromptHub\\data`, a separate
  current roaming path, cancellation, explicit selection, restart, and failure
  rollback.
- `TEST-LEGACYREC-097`: import a v0.5.1 portable backup and restore a v0.5.2
  upgrade snapshot, then exercise corrupt JSON, partial manifests, unsupported
  versions, symlinks, capacity limits, interruption, and idempotent retry.
- `TEST-LEGACYREC-098`: migrate/import a Prompt with versions 1 through 4 and
  assert database rows, `VERSION_GET_ALL`, rendered history, restart, and
  rollback to versions 2 and 3.
- `TEST-LEGACYREC-004`: inject failure before staging, after staging, during
  validation, before publish, and during publish; the active source and its
  recovery point MUST remain usable.
- `TEST-LEGACYREC-005`: measure the bounded candidate and history fixtures and
  record elapsed time, peak temporary disk, and maximum resident data.
