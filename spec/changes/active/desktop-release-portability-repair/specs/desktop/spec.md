# Desktop Release Portability Repair Spec

## Modified Requirements

### `FR-PORT-001`: Startup Entry Must Exclude Test-Only Backup Code

The normal desktop renderer startup path MUST load the app shell through an async boundary and MUST NOT expose or request the E2E backup bridge outside the explicit E2E profile.

#### Scenario: Normal desktop launch

- **WHEN** the desktop app starts without `PROMPTHUB_E2E=1`
- **THEN** `window.electron.e2e` is absent
- **AND** the database backup bridge is not loaded by the renderer bootstrap
- **AND** the renderer waits for `i18nReady` before mounting the application shell.

#### Scenario: Electron E2E launch

- **WHEN** the runner starts Electron with `PROMPTHUB_E2E=1`
- **THEN** the preload bridge exposes its existing E2E methods
- **AND** the backup bridge is ready before the renderer application mounts
- **AND** backup/restore E2E tests can invoke it without a timing race.

### `FR-PORT-002`: Backup Restore Must Not Reuse Machine-Local Skill Paths

Skill backup restore MUST preserve portable Skill metadata and source-update baselines while excluding `local_repo_path` from the restored create payload.

#### Scenario: Restore a Skill from a previous machine

- **GIVEN** a backup Skill has a `local_repo_path` from another machine or a deleted managed repo
- **WHEN** the backup is restored
- **THEN** `skill:create` does not receive that path
- **AND** restored Skill files are written into a newly resolved PromptHub-managed repository
- **AND** source identifiers, source URLs, and package fingerprint/baseline fields remain available for source reconciliation.
