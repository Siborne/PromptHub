# Desktop Startup Delta

## Requirements

### FR-WINSTART-001 Windows Upgrade Durability

When PromptHub creates or migrates durable files during Windows startup, every
file passed to `fsync` must have been opened with write permission.

#### Scenario: Existing user upgrades from the stable release

- Given a valid `0.5.9` user-data database and last-run marker
- When the packaged Windows x64 candidate starts
- Then the upgrade safety snapshot is created without `EPERM`
- And the renderer window finishes loading

#### Scenario: Legacy database is recovery evidence

- Given a non-SQLite legacy database file
- When PromptHub preserves it in an upgrade snapshot
- Then the copied evidence is durably flushed and hashed
- And the operation does not use a read-only flush handle

#### Scenario: Windows rejects directory fsync after marker commit

- Given a desktop skill reconciliation marker whose temporary file was flushed
  and atomically renamed
- When Windows returns `EPERM` for the best-effort parent-directory `fsync`
- Then startup keeps the committed marker and continues
- And file-level durability failures remain fatal

### FR-WINSTART-002 Release Blocking Gate

The release workflow must execute the unpacked packaged Windows x64 application
against an isolated `0.5.9` upgrade fixture before uploading Windows artifacts.

#### Scenario: Packaged startup fails

- When the process exits early, reports startup failure, or does not load its
  renderer within the bounded timeout
- Then the Windows x64 build job fails
- And the release job cannot publish or refresh release assets

### NFR-WINSTART-001 Isolation And Cleanup

The packaged startup smoke must not read or write the runner's normal PromptHub
profile. It must use a task-owned temporary AppData tree, bounded polling, and
must terminate and clean up its own process and files.

#### Scenario: CI requests an isolated packaged profile

- Given a packaged Windows process running in CI
- And the requested AppData root is below `RUNNER_TEMP`
- When PromptHub starts
- Then Electron uses that AppData root before normal data-path resolution
- And the normal runner profile is not selected

#### Scenario: An untrusted override is supplied

- Given a development process, a non-Windows process, a non-CI process, or a
  path outside `RUNNER_TEMP`
- When the release-smoke AppData override is present
- Then startup rejects the override instead of using that path

#### Scenario: Windows releases packaged-process handles asynchronously

- Given the packaged startup assertions have passed
- When terminating the task-owned process tree leaves a temporary handle busy
- Then the smoke waits for process close and retries only transient Windows
  cleanup errors within a bounded budget
- And persistent or non-transient cleanup failures still fail the build

## Acceptance Criteria

- `AC-WINSTART-001`: Unit regressions simulate the Windows requirement that a
  flushed file descriptor has write access.
- `AC-WINSTART-002`: The packaged smoke observes both a created upgrade snapshot
  and a renderer-loaded startup event.
- `AC-WINSTART-003`: The release record remains blocked until the complete
  workflow, including Windows packaged startup, passes.
- `AC-WINSTART-004`: A successful packaged launch is not turned into a false
  failure by the bounded Windows process-handle release race.

## Traceability

| Requirement        | Design             | Verification                                                  | Task                               |
| ------------------ | ------------------ | ------------------------------------------------------------- | ---------------------------------- |
| `FR-WINSTART-001`  | `DES-WINSTART-001` | `TEST-WINSTART-001`, `TEST-WINSTART-005`                      | `T-WINSTART-001`, `T-WINSTART-005` |
| `FR-WINSTART-002`  | `DES-WINSTART-002` | `TEST-WINSTART-002`                                           | `T-WINSTART-002`                   |
| `NFR-WINSTART-001` | `DES-WINSTART-003` | `TEST-WINSTART-003`, `TEST-WINSTART-004`, `TEST-WINSTART-006` | `T-WINSTART-003`, `T-WINSTART-006` |
