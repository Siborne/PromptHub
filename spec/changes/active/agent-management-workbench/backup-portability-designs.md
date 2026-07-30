# Agent Management Backup Portability Designs

## `DES-AGENT-054`: Provider Profile Portable Backup Section

The full desktop database backup format MAY contain one optional
`agentManagement` section with schema version `1`. The section is owned by the
Agent main-process runtime rather than renderer state and contains only:

- Provider Profile public metadata;
- ordered model mappings with bounded public JSON parameters;
- bounded, redacted activation snapshot metadata.

Secret values, secure-store references, encrypted native-config backup
references, absolute Agent roots, session source/index state and transcript
bodies are excluded. Existing settings backup continues to own Agent workspace
preferences; this section does not duplicate them.

The section is optional so backups created before this batch remain valid. A
legacy backup without `agentManagement` MUST leave current Provider Profiles
unchanged rather than treating absence as an empty replacement.

### Validation And Capacity

The shared parser is the single format validator used by renderer format
normalization, IPC input validation and database replacement. It rejects
unknown fields, credential-like public JSON, duplicate durable identities and
broken snapshot references before any mutation.

The version-one bounds are:

- at most 1,000 Provider Profiles;
- at most 100 model mappings per Profile;
- at most 5,000 redacted activation snapshots.

Validation is linear in the number of Profiles, mappings and snapshots:
`O(p + m + s)` time and `O(p + m + s)` bounded identity-set space. Export uses
one bounded Profile query, one bounded snapshot query and the existing
per-Profile mapping projection. The current 1,000 by 100 limits keep that
worst-case I/O finite; a future bulk mapping query can optimize the export
without changing the format.

### Main-Process Ownership

The renderer asks the Agent runtime to export or restore the portable section
through typed IPC. It never receives secret values, secure-store references or
native encrypted-backup references.

On export, the main process:

1. reads active and archived Profiles plus their mappings;
2. reads at most 5,000 redacted snapshots;
3. strips all local secret and backup references;
4. returns the validated version-one section.

On restore, the main process:

1. validates the complete section;
2. checks the derived secure-store reference for every secret-requiring
   Profile without exposing it;
3. replaces Profile, mapping and snapshot rows in one SQLite transaction;
4. reports which restored Profile ids have an available same-device secret and
   which require credential repair.

Restored Profile ids and timestamps are preserved so snapshot references
remain coherent. A secret-requiring Profile receives only its deterministic
main-owned secure-store reference. A same-device secret may therefore become
ready again; a cross-device restore remains explicitly missing until the user
re-enters the credential. Native encrypted-config backup references are always
cleared because they are device-local recovery artifacts, not portable data.

Any validation or SQLite failure leaves existing Agent rows unchanged.
Failures are projected through stable Agent backup error codes and do not echo
the rejected payload.

### Restore Order And Compatibility

The desktop restore workflow restores canonical settings and store-source
state first, then invokes the Agent main-process restore. Agent path detection,
native-config reconciliation and session-source preference portability remain
later work under `T-AGENT-023`; this batch does not claim those steps complete.

Selective export/import does not include this section yet. Adding an Agent
selector, session-source preferences and cross-device path repair requires its
own test-first batch, but MUST extend this versioned contract rather than
creating a second Provider backup source.

### Verification

`TEST-AGENT-073` covers:

- strict shared parsing, capacity bounds and credential/reference rejection;
- real SQLite export and transactional replacement;
- same-device available-secret and missing-secret readiness;
- rollback after an injected SQLite failure;
- main IPC validation and error redaction;
- preload exposure and full desktop backup/restore wiring;
- legacy backups preserving existing Agent data;
- session transcript and runtime-state exclusion.

`T-AGENT-109` implements this bounded full-backup batch. It advances but does
not close `T-AGENT-023` or the broader `TEST-AGENT-014` compatibility gate.

## `DES-AGENT-055`: Agent-Aware Selective And Full ZIP Export

The existing selective export contract gains one optional `agents` scope bit.
When enabled, the embedded PromptHub export payload includes the validated
`agentManagement` section from `DES-AGENT-054`; when disabled, the export
MUST neither query the Agent main-process backup service nor include the
section.

The Data Settings selector exposes this scope as a localized, keyboard
activatable `Agents` option. It is enabled by default, while users may disable
it independently of Settings, Skills, MCP and Plugins. The option controls
Provider Profile portability only: Agent workspace preferences remain owned by
the Settings scope and owning-domain asset data remains controlled by its
existing Skills, MCP, Rules and Plugins scopes.

The UI's Full Backup and pre-upgrade backup workflows continue to use the
single selective ZIP implementation, but MUST pass `agents: true`. This closes
the discrepancy where direct JSON backup contained Agent management data while
the user-facing Full Backup ZIP silently omitted it.

Old export envelopes without the scope bit remain importable because import is
driven by the optional payload section, not by scope metadata. No new storage,
schema, IPC channel or Agent fact source is introduced.

`TEST-AGENT-074` covers the red discrepancy, opt-in/opt-out payload behavior,
skipped main-process I/O, Full Backup/pre-upgrade scope and the localized
keyboard-accessible selector. `T-AGENT-110` implements this export wiring and
advances, but does not close, the remaining session preference and
cross-device path work in `T-AGENT-023`.

## `DES-AGENT-056`: Portable Session Preference Rebinding

Persistent session indexing remains owned by `AgentSessionIndexDB`. The Agent
backup format adds an optional, bounded `sessionSourcePreferences` array with
only `platformId`, `adapterId` and `enabled`. Export reads bounded source rows
in newest-first order and keeps the newest persisted preference for each
platform, but includes it only when the current main-process session registry
can resolve that platform. The serialized adapter id is portable source
evidence, not a second identity or a path selector. Absolute roots, adapter
versions, cursors, scan status, indexed metadata, annotations and transcript
data remain device-local and are never serialized.

Restore validates the complete Agent section before any write. For every
portable preference, the main process asks the existing session service for
the current platform descriptor. A resolved preference is registered against
that descriptor's current root and adapter version; the root from the source
device does not exist in the format. A descriptor change therefore rebinds the
platform-level enabled preference to the current supported adapter rather than
restoring a stale path.

An unknown or currently unsupported platform is returned as one bounded
unresolved preference key. Restore does not create a placeholder path or
adapter. Current PromptHub exports only preferences whose platform is
resolvable, so this branch exists for forward compatibility and explicit
repair reporting rather than as a second persistent source.

Provider replacement and all resolved preference writes execute in one outer
SQLite transaction. The existing Provider and session repositories reuse that
transaction; a failure in either domain rolls the entire Agent section back.
Secret availability is checked before the transaction and the renderer still
receives only Profile ids plus portable preference counts/keys.

The preference bound is 128 identities. Export and validation are `O(n)` time
and bounded `O(n)` identity-set space. The DB query reads at most 129
newest-first source rows to detect overflow, and the service keeps the first
row per platform; it never loads session index rows.

`TEST-AGENT-075` covers optional-field compatibility, strict parsing, duplicate
and capacity rejection, root/runtime exclusion, current-device rebinding,
unsupported reporting and transaction rollback after an injected session
write failure. `T-AGENT-111` implements this final `T-AGENT-023` portability
batch without adding a preference table or changing transcript ownership.
