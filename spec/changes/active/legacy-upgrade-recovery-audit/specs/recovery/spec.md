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
When a canonical authority marker exists, the file graph is the durable source
of truth and SQLite is a rebuildable projection. Startup MUST validate the file
graph before opening SQLite. A valid graph MUST automatically repair a missing,
corrupt, or logically stale SQLite projection without showing recovery UI.

When the canonical Prompt graph was damaged by an older writer but the current
legacy Prompt Markdown workspace is complete, unique, parseable, and has
deterministically resolvable media, startup MUST automatically stage and
journal-publish a repaired canonical graph from those files. SQLite MAY supply
same-id Prompt history and non-authoritative operational rows only; it MUST NOT
select current Prompt content. Explicit recovery selection is required only
when the file inputs are missing, unsafe, malformed, duplicate, or divergent.
Modification time and SQLite row count MUST NOT outrank a valid file source.

Canonical recovery MUST accept existing MCP target-binding identities derived
from an absolute target path. If recovery fails after SQLite is closed, the
application MUST reopen the original database and rebind database-backed IPC
handlers before reporting the retryable failure to the renderer.

When the selected SQLite catalog is projected while canonical MCP bundles are
empty, recovery MUST read the exact superseded `data/mcp/library.json` as a
bounded, non-publishing input. Credential values MUST be materialized only in
the staged checkpoint and persisted through the device-bound secret sink;
recovery MUST NOT run the ordinary compatibility publisher against the damaged
active root. The failure rebind MUST remove every handler that `registerAllIPC`
will register again, including handlers registered by nested domain modules.
The reset set MUST be derived from successful registration rather than a
manually maintained channel inventory, and partial registration failure MUST
remove the handlers registered by that failed attempt.

When the current legacy Prompt Markdown workspace is complete enough to form a
recovery candidate, its files MUST be authoritative for the current Prompt
set, Folder graph, and current Prompt fields. SQLite MAY supplement version history only for
Prompt ids still present in the file workspace and MUST NOT overwrite current
file content or resurrect database-only Prompts. Candidate validation and
recovery MUST NOT move, rewrite, or delete the source Markdown files. Missing
Prompt media MAY be sourced only from the active asset root or validated,
allowlisted recovery/upgrade artifacts. Multiple copies of one reference MUST
have the same SHA-256 digest; missing, unsafe, or divergent copies MUST fail
before publication. The rebuilt graph MUST still use staged validation and the
journaled authority publication boundary.

Automatic repair MUST reject malformed or cyclic Folder/Prompt parent graphs,
undeclared workspace files, symlinks, oversized files, and unbounded
inventories. A missing or unreadable SQLite file MUST NOT hide an otherwise
valid file recovery candidate. Catalog replacement MUST hold the migration and
storage-maintenance intents and MUST refuse to run while another database
client lease is live.

Canonical startup MUST NOT export SQLite back into the legacy Markdown layout.
After successful conversion, managed canonical bundles remain the file
authority and the pre-conversion Markdown tree remains available in the
journaled recovery artifact. A corrupt or unreadable device-local MCP secret
store MUST NOT block Prompt graph self-heal because unrelated canonical MCP,
Skill, Rule, Plugin, Agent, and Generation bundles are preserved byte-for-byte.
Exact empty legacy Rule containers MAY coexist with canonical Rule bundles;
non-empty or unsafe substitutions MUST fail before publication. Rebuilding the
local catalog MUST preserve server Skill ownership only when its
server-authoritative user row is available, otherwise it MUST project a null
local owner without rewriting the Skill bundle. Duplicate active Agent profile
names MUST be resolved deterministically in the derived catalog by retaining
the newest profile active and projecting older duplicates archived, without
rewriting their bundles.

### `FR-LEGACYREC-010`: File-authoritative AI model migration and repair

Before renderer persistence migration, a non-empty `config/ai-models.json`
provider/model inventory MUST outrank default-empty renderer arrays and MUST be
published into `config/providers.json` plus the encrypted device vault. The
migration MUST NOT replace that file-owned inventory with empty arrays.

For a completed 0.6.0 renderer migration whose canonical model list is empty
while model routes still reference model ids, startup MUST inspect only the
bounded managed upgrade safety points, newest first. It MAY automatically
restore a candidate only when it is a regular bounded AI config file and
contains every currently routed model id. Restoration MUST use the existing
atomic renderer-persistence publication and encrypted vault, preserve route
assignments, redact the compatibility AI file, and be idempotent. An
intentionally empty list with no routed ids, an unsafe candidate, or no exact
candidate MUST remain unchanged rather than selecting an approximate backup.

### `FR-LEGACYREC-011`: Preserve managed Skill symlink distributions

When canonical Skill migration replaces a legacy PromptHub-managed repository
path with an id-based materialized workspace, existing Agent Skill symlinks
created by PromptHub MUST remain usable. After canonical workspaces are
materialized and before Agent Skill discovery, startup MUST reconcile a
symlink only when the platform activation record identifies the same current
Skill id and name and the link's stored target has the exact legacy
`data/skills/<managed-container>/repo` shape beneath the active data root.
This applies whether the superseded target still exists or has become dangling.

The replacement target MUST be the current regular, non-symlink canonical
workspace for that Skill and MUST contain a regular `SKILL.md`. Replacement
MUST use a same-directory staged link and atomic rename so failure before
publication preserves the original link.
Arbitrary external dangling links, missing or mismatched activation records,
unsafe workspaces, non-link user content, and ambiguous records MUST remain
unchanged. Reconciliation MUST be bounded, idempotent, local-only, and MUST NOT
delete either the canonical Skill package or an external source directory.

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
  divergent SQLite and legacy workspace candidates; assert a valid unique
  Markdown workspace automatically repairs the canonical graph, rebuilds the
  SQLite projection, preserves same-id history, and does not show recovery UI.
  Assert duplicate ids, malformed files, missing/divergent media, unsafe paths,
  and publication failure remain recovery-required and leave the active source
  unchanged.
  Exercise a path-derived MCP binding id and a failed recovery; assert the id
  survives canonical projection and subsequent IPC reads use the reopened
  database rather than the closed connection. Project a credential-bearing
  superseded MCP library without mutating it, reject oversized or unsafe
  metadata, and reproduce a second `prompt:getAllMeta` registration during
  recovery rebinding. Reproduce the nested `skill:scanPlatformSkills` collision
  and a partial registration failure, then assert both retries cleanly remove
  only handlers captured from the preceding attempt. Recover from divergent
  SQLite/current Markdown fixtures and assert Markdown owns the current Prompt
  set and body while valid same-id database history remains supplemental.
  Assert candidate inspection leaves duplicate Markdown files untouched, and
  exercise missing media, identical allowlisted backup copies, divergent
  backup copies, symlinks, and path traversal before journaled publication.
  Corrupt or stale the derived SQLite catalog beneath a valid canonical graph
  and assert startup atomically rebuilds it; a second startup MUST be idempotent.
  Assert canonical bootstrap performs no DB-to-legacy-workspace write and an
  invalid MCP secret value cannot block Prompt self-heal. Assert exact legacy
  Folder ownership, parent-before-child import, bounded workspace inspection,
  missing-SQLite candidate discovery, and live-client replacement refusal.
- `TEST-LEGACYREC-010`: migrate default-empty renderer provider/model arrays
  beside a populated file-owned AI config and assert the complete inventory,
  routes, and encrypted credentials survive. Reproduce the completed-migration
  state with zero models and dangling routes, then restore from the newest
  bounded upgrade candidate containing every routed id. Assert restart
  idempotency, redaction, intentional-empty no-op behavior, malformed/symlink
  rejection, and atomic publication rollback.
- `TEST-LEGACYREC-011`: materialize a canonical Skill workspace beside a
  platform activation record and a link to the exact legacy managed
  repository layout. Assert startup atomically rebinds it by Skill id, keeps
  the Skill readable for both retained and missing old targets, and is
  idempotent. Assert external dangling links,
  mismatched ids/names, unsafe or missing workspaces, oversized/malformed state,
  non-link content, and injected replacement failure remain unchanged.
