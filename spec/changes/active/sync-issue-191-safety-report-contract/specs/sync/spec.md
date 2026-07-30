# Spec Delta: Sync Safety Report Compatibility

## Added Requirements

### `FR-SYNC191-001`: Accept current safety scan provenance

PromptHub MUST accept a valid sync Skill carrying `scanMethod: "ai"` or
`scanMethod: "preflight"` without rejecting the backup.

#### Scenario: Desktop preflight report reaches self-hosted Web

- **GIVEN** a Desktop snapshot containing a structurally valid Skill safety
  report with `scanMethod: "preflight"`
- **WHEN** the Web sync boundary parses the snapshot
- **THEN** the snapshot is accepted
- **AND** the parsed report still records `preflight`.

### `FR-SYNC191-002`: Normalize only the legacy provenance field

PromptHub MUST normalize the legacy scan method `static` to `preflight`.
An unknown scan method MUST remove only that Skill's auxiliary safety report
instead of rejecting or deleting the Skill.

#### Scenario: Legacy and unknown scan methods

- **GIVEN** otherwise valid Skills containing `static` and an unknown scan
  method
- **WHEN** the snapshot is parsed
- **THEN** `static` becomes `preflight`
- **AND** the unknown-method Skill remains present without `safetyReport`
- **AND** unrelated malformed safety report fields still fail validation.

### `FR-SYNC191-003`: Restored reports do not authorize installation

PromptHub MUST treat a safety report restored from backup as descriptive
metadata, not as fingerprint-pinned approval for a future install or update.

#### Scenario: Restored report has no authorization effect

- **GIVEN** a restored Skill containing an accepted safety report
- **WHEN** a later install or update requires safety approval
- **THEN** the operation follows the current package fingerprint and safety
  policy
- **AND** the restored report alone cannot bypass review or blocking.

### `NFR-SYNC191-001`: Bounded normalization

Compatibility normalization MUST perform one bounded pass over the Skill list
and MUST NOT recursively clone media, plugin packages, or unrelated snapshot
collections.

#### Scenario: Large valid snapshot

- **GIVEN** a snapshot containing many Skills and unrelated large collections
- **WHEN** compatibility normalization runs
- **THEN** work is linear in the number of Skills
- **AND** unchanged nested collections retain their existing references until
  normal schema parsing occurs.

## Modified Requirements

- The stable sync contract now treats `preflight` as the current deterministic
  scan provenance and `static` as its legacy alias.

## Removed Requirements

- None.

## Verification

- `TEST-SYNC191-001`: Web contract test using a Desktop-shaped Skill payload
  proves that `preflight` is accepted and preserved.
- `TEST-SYNC191-002`: table-driven unit tests cover `ai`, `preflight`,
  legacy `static`, unknown strings, missing reports, and malformed non-method
  fields.
- `TEST-SYNC191-003`: route/service integration proves invalid non-method data
  performs no remote snapshot write and restored reports do not create approval.
- `TEST-SYNC191-004`: a large Skill inventory proves normalization is linear,
  bounded, and does not copy unrelated collections.
