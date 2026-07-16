# Spec Delta: CLI Runtime Recovery

## Added Requirements

### `FR-CR-001`: Legacy desktop wrapper migration

PromptHub Desktop MUST identify the retired shell wrapper that launches the Electron binary with `--cli` without executing that wrapper, MUST report it as requiring migration rather than a working standalone CLI, and MUST remove only that exact wrapper after standalone installation succeeds.

#### Scenario: Legacy wrapper shadows standalone command

- **GIVEN** the resolved command points to the recognized Desktop wrapper
- **WHEN** Settings checks CLI status
- **THEN** it does not launch Electron or the updater
- **AND** it reports a legacy installation requiring standalone installation.

#### Scenario: Retired desktop CLI entry is invoked directly

- **GIVEN** the packaged Electron executable receives `--cli`
- **WHEN** the process becomes ready
- **THEN** it exits with an actionable standalone CLI migration message
- **AND** updater, database, migration, and window bootstrap do not run.

### `FR-CR-002`: Guarded ownerless lock recovery

PromptHub CLI MUST expose an explicit database-lock diagnostic and recovery command while normal resource commands continue to preserve ownerless locks by default.

#### Scenario: User explicitly recovers an ordinary ownerless lock

- **GIVEN** the database lock is a non-symlink directory with no live or unknown registered clients
- **WHEN** `prompthub doctor database-lock --recover` runs
- **THEN** stale leases and the orphan lock are removed
- **AND** the command returns a structured summary without opening the application database.

#### Scenario: Recovery cannot prove safety

- **GIVEN** a live lease, an unknown lease entry, a symlink, or a non-directory lock
- **WHEN** recovery is requested
- **THEN** the lock remains untouched
- **AND** the CLI returns an actionable conflict.

## Verification

- `TEST-CR-001`: Desktop unit tests prove the legacy wrapper is read but never executed, is removed only after successful standalone installation, and direct retired invocation exits before bootstrap.
- `TEST-CR-002`: DB/CLI tests cover absent, recoverable, live, unknown, symlink, and non-directory lock states plus normal conservative startup.
