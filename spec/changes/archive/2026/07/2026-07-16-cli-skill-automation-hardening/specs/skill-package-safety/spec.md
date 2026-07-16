# Spec Delta: Skill Package Safety

## Added Requirements

### `FR-SP-001`: One package ignore policy

PromptHub MUST apply the shared built-in Skill ignore rules and an optional root `.prompthubignore` to CLI package inventory, managed copies, fingerprints, version snapshots, project/platform distribution, and secret scanning.

#### Scenario: Generated and user-ignored files stay outside the package

- **GIVEN** a Skill contains `.DS_Store`, dependencies, local environment files, generated output, and paths matched by `.prompthubignore`
- **WHEN** it is imported, snapshotted, fingerprinted, or distributed
- **THEN** those paths are omitted consistently
- **AND** root `SKILL.md` remains included even if a custom pattern attempts to ignore it.

### `FR-SP-002`: Secret snapshot guard

PromptHub MUST block high-confidence private keys, provider tokens, and password assignments before a Skill package is copied into managed storage, captured in a version snapshot, or distributed.

#### Scenario: Package contains a secret

- **GIVEN** a non-ignored text file contains a supported high-confidence secret pattern
- **WHEN** import, snapshot, or distribution is requested
- **THEN** the operation fails before its external side effect
- **AND** diagnostics include only finding type, file path, and line number, never the secret value.

#### Scenario: Package contains examples

- **GIVEN** configuration examples use placeholders such as `${TOKEN}`, `<password>`, or `your-api-key`
- **WHEN** package policy runs
- **THEN** the package remains allowed.

#### Scenario: Package exceeds the bounded scan capacity

- **GIVEN** a filtered Skill package exceeds 500 entries, 2 MiB for one text file, or 16 MiB cumulative text
- **WHEN** import, snapshot, or distribution is requested
- **THEN** the operation fails before its external side effect
- **AND** it does not silently copy an unscanned tail of the package.

## Verification

- `TEST-SP-001`: Pure matcher tests cover built-ins, negation, directory patterns, Unicode paths, and protected root `SKILL.md`.
- `TEST-SP-002`: Filesystem integration tests prove ignored files never reach managed copies, snapshots, or platform targets.
- `TEST-SP-003`: Security tests cover private keys, common provider tokens, generic credentials, placeholders, ignored secrets, JSON/GitHub imports, redacted diagnostics, and bounded entry/byte limits.
