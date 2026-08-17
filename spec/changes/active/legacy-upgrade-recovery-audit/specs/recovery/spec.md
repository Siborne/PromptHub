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

### `FR-LEGACYREC-006`: Empty Prompt version-chain recovery

When a legacy Prompt has no stored `prompt_versions` rows, startup migration
MUST synthesize version 1 from the current Prompt row before strict canonical
resource validation. The migration MUST align `current_version` to the highest
positive stored version, preserve existing valid version rows, and remain
idempotent across repeated startup. Canonical resource validation MUST continue
to reject non-positive versions after migration.

### `FR-LEGACYREC-007`: Canonical startup preparation and Rule placeholders

Desktop startup MUST finish source-database migrations before projecting the
canonical authority. A built-in Rule platform record MAY remain in SQLite as an
unmaterialized discovery placeholder when its target is missing, its current
version is zero, and it has no managed content, target content, or history.
Canonical publication MUST exclude only that empty placeholder shape. A Rule
with content or history MUST remain subject to strict positive-version
validation even when its target file is missing.

### `FR-LEGACYREC-008`: Canonical root coexistence

Canonical Prompt, MCP, and Plugin readers MUST coexist with runtime artifacts that have
separate owners in the same data root. Prompt graph verification MUST ignore
the legacy `.versions` workspace only when it is a real directory. Canonical
Prompt graph verification MUST also ignore the Agent appearance workspace
`agent-appearance` only when it is a real directory. Canonical MCP discovery
MUST ignore `market-sources.json` and the superseded `library.json` only when
they are real files. Canonical Plugin discovery MUST ignore the superseded
`library.json`, `market-cache.json`, and `versions.json` only when they are real
files. Symlinks, type mismatches, and other undeclared paths MUST remain
rejected. When canonical authority has no MCP or Plugin bundles but an exact
superseded library still contains records, the owning service MUST migrate
those records into canonical bundles before removing the superseded metadata.
When canonical bundles already exist, they MUST remain authoritative and the
superseded metadata MUST NOT overwrite or resurrect older records. Failed
migration MUST leave the superseded library available for retry.
Before self-hosted sync has assigned an identity, a null renderer device ID
MUST NOT block local MCP or Plugin compatibility migration. Device-local
binding or projection state MUST use a stable storage-root identity in that
case.

### `FR-LEGACYREC-009`: Downgrade refusal and invalid-authority recovery

An application version older than the last version that wrote the active data
root MUST fail before database, canonical resource, or legacy workspace writes.
When a canonical authority marker exists but its declared graph is missing,
unsafe, or inconsistent, startup MUST enter an explicit recovery-required state
instead of trusting the marker or rebuilding from SQLite or legacy Markdown.
PromptHub MUST preserve and identify each validated recovery candidate and MUST
require an explicit source selection before replacing the active canonical
graph.

Canonical recovery MUST accept existing MCP target-binding identities derived
from an absolute target path. If recovery fails after SQLite is closed, the
application MUST reopen the original database and rebind database-backed IPC
handlers before reporting the retryable failure to the renderer.

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
- `TEST-LEGACYREC-006`: initialize a tagged historical database after the old
  current-version migration marker has already been applied, with one Prompt at
  version 0 and another at version 1 but neither having a version row. Assert
  synthesized version-1 content, aligned counters, complete canonical graph
  validation, and no duplicate versions after reopen.
- `TEST-LEGACYREC-007`: assert source-database preparation runs before
  canonical publication and preparation failure blocks publication. Project a
  target-missing Rule placeholder with no content or history and assert it is
  omitted, while the existing strict Rule resource tests continue to reject
  malformed materialized records.
- `TEST-LEGACYREC-008`: materialize a canonical Prompt graph beside a legacy
  `.versions` tree and an Agent appearance workspace, then read empty canonical
  MCP and Plugin libraries beside their exact superseded metadata and runtime
  registry files. Assert all valid coexistence paths load, while symlink, file,
  or directory type substitution still fails closed. Assert a populated
  superseded library migrates once, secrets remain outside MCP bundles, an
  empty superseded library is removed, and existing canonical bundles win over
  stale metadata.
- `TEST-LEGACYREC-009`: launch an older version against a newer-version marker
  and assert no database, canonical resource, legacy workspace, or version
  marker write occurs. Corrupt a catalog-declared Prompt bundle while retaining
  divergent SQLite and legacy workspace candidates; assert startup reports
  recovery-required and leaves every source unchanged until explicit selection.
  Exercise a path-derived MCP binding id and a failed recovery; assert the id
  survives canonical projection and subsequent IPC reads use the reopened
  database rather than the closed connection.
