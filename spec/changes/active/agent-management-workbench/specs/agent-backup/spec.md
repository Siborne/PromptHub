# Agent Management Backup Delta

### `FR-AGENT-048`: Provider Profile Portable Full Backup

The full desktop backup MUST preserve Provider Profile public metadata, model
mappings and bounded redacted activation snapshots in one optional versioned
Agent section. The section MUST exclude secret values, secure-store
references, native encrypted-backup references, absolute Agent roots, session
indexes and transcript bodies.

Restore MUST validate the whole section before mutation and replace its Agent
rows in one SQLite transaction. It MUST preserve durable Profile and snapshot
identities, clear device-local native backup references, derive secure-store
references only inside the main process and report whether each restored
secret-requiring Profile is ready on the current device or needs credential
repair. A backup without the optional section MUST leave existing Provider
Profiles unchanged.

#### Scenario: Restore on the device that created the backup

- Given a full backup contains a Profile that requires a credential
- And the deterministic secure-store entry still exists on this device
- When the backup is restored
- Then the Profile, mappings and redacted snapshots are restored atomically
- And the Profile is reported as credential-ready
- And no secret or secure-store reference appears in the backup or renderer

#### Scenario: Restore on another device

- Given a valid full backup contains a Profile that requires a credential
- And no matching secure-store entry exists on the current device
- When the backup is restored
- Then the non-secret Profile data is restored
- And the Profile is reported as requiring credential repair
- And no native encrypted-backup reference is restored

#### Scenario: Restore a legacy or malformed backup

- Given a legacy backup has no Agent section
- When it is restored
- Then existing Provider Profiles are not cleared
- But given an Agent section with a secret-like field, duplicate identity or
  broken snapshot reference
- When restore is attempted
- Then validation fails before any Agent row is changed

### `FR-AGENT-049`: Agent-Aware Selective And Full Export

Selective export MUST expose an independent Agent scope for the portable
Provider Profile section. Enabling it MUST include the validated Agent section;
disabling it MUST omit the section and skip the main-process Agent backup
query. Settings and owning-domain asset scopes remain independent.

The user-facing Full Backup and pre-upgrade backup flows MUST enable the Agent
scope so their ZIP payload is equivalent to a complete portable backup. Export
envelopes created before this scope existed MUST remain importable.

#### Scenario: Export only Agent management

- Given one or more Provider Profiles exist
- When the user keeps the Agents scope enabled and disables unrelated scopes
- Then the embedded export payload contains the portable Agent section
- And it contains no secret, session transcript or duplicated asset data

#### Scenario: Exclude Agent management

- Given the user disables the Agents scope
- When the selective export is created
- Then the Agent main-process backup API is not called
- And the export payload has no Agent section

#### Scenario: Create a Full Backup ZIP

- Given the user chooses Full Backup or PromptHub creates a pre-upgrade backup
- When the shared selective ZIP workflow runs
- Then its scope includes Agents
- And the embedded payload can restore portable Provider Profile data

### `FR-AGENT-050`: Portable Session Source Preferences

The Agent backup section MUST preserve only the enabled preference for each
currently supported persistent session source. It MUST NOT contain a source
root, indexed session metadata, scan cursor, transcript path, transcript body,
annotation, error detail or other device-local runtime state.

Restore MUST resolve the current platform's session descriptor inside the main
process and bind the preference to that descriptor's current local root and
adapter version. Provider Profile replacement and resolved session preference
writes MUST share one SQLite transaction. Unsupported imported preferences
MUST be reported as unresolved without inventing an adapter or filesystem
path.

#### Scenario: Restore on a different home directory

- Given Claude persistent indexing was enabled on another device
- And the backup contains no absolute session root
- When the backup is restored on the current device
- Then the enabled preference is bound to the current Claude descriptor root
- And no source path, cursor, index row or transcript is copied from the backup

#### Scenario: Restore fails while applying a preference

- Given Provider Profiles and a supported session preference are valid
- And SQLite rejects the resolved session source write
- When restore runs
- Then Provider Profiles, mappings, snapshots and session source preferences
  all retain their pre-restore state

#### Scenario: Restore an older or unsupported preference

- Given an older Agent section has no session preference field
- When it is restored
- Then existing session source preferences remain unchanged
- But given a valid imported preference cannot be resolved by the current
  platform registry
- Then it is reported as unresolved
- And PromptHub does not invent a root or enable an unrelated adapter
