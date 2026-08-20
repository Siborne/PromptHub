# Windows Canonical Authority Second-Launch Delta

## Added Requirements

### `FR-WINCAT-001`: Second Launch Must Complete Canonical Publication

After an upgraded Windows profile completes its first loaded window and writes
the renderer persistence marker, reopening the same profile MUST complete
canonical authority publication without a startup error and MUST load the main
window.

#### Scenario: First launch hands off to renderer migration

- **Given** a packaged Windows x64 application opens an existing `0.5.9`
  profile
- **When** the renderer persistence marker does not yet exist
- **Then** startup records `waiting-renderer-migration`
- **And** the renderer reaches `startup:window_ready`
- **And** renderer persistence migration durably completes
- **And** the process exits through normal application cleanup

#### Scenario: Second launch publishes canonical authority

- **Given** the first launch completed against the same isolated profile
- **When** the packaged application starts again
- **Then** canonical authority publication completes
- **And** no canonical storage startup failure is recorded
- **And** the renderer reaches `startup:window_ready`

### `NFR-WINCAT-001`: Bounded SQLite Temporary Paths

Canonical SQLite verification and stage basenames MUST have a fixed upper bound
independent of checkpoint and destination basenames. Each temporary database
MUST remain a unique sibling on the owning filesystem so publication retains
same-filesystem behavior, atomic rename, and bounded cleanup.
Startup and selected-database recovery checkpoint target/stage directory names
controlled by PromptHub MUST also be bounded and MUST NOT duplicate one
another, because they are ancestors of the SQLite paths subject to the Windows
VFS limit.

#### Scenario: Long verification catalog basename

- **Given** a verification database already has a UUID-bearing catalog name
- **When** PromptHub creates its verification database and SQLite stage
- **Then** neither basename copies the checkpoint or destination basename
- **And** the checkpoint stage does not copy the checkpoint target basename
- **And** both remain within the documented fixed basename budget
- **And** failure removes the stage and SQLite sidecars

#### Scenario: selected-database recovery creates a checkpoint

- **Given** a user selects a database recovery source under a long Windows
  profile path
- **When** PromptHub creates the canonical recovery checkpoint
- **Then** its task-owned checkpoint basename uses the same bounded UUID form as
  startup
- **And** it does not append a PID or repeat a recovery-specific prefix

### `FR-WINCAT-002`: Release Gate Covers The Same Profile Twice

The Windows x64 release job MUST run the packaged upgrade smoke twice against
one runner-owned profile. A first-launch-only success MUST NOT unblock artifact
publication.

#### Scenario: Second launch fails

- **Given** the first packaged launch succeeds
- **When** the second launch reports canonical authority failure, exits early,
  or times out
- **Then** the Windows x64 build job fails
- **And** the Release job cannot publish or replace Windows artifacts

## Acceptance Criteria

- `AC-WINCAT-001`: The verification database and catalog stage basenames are
  bounded and independent of their target basenames.
- `AC-WINCAT-002`: Existing failure cleanup remains verified.
- `AC-WINCAT-003`: Release-smoke auto-exit is unavailable outside packaged
  Windows CI with a runner-owned AppData path, and cannot run before both
  window readiness and renderer migration completion.
- `AC-WINCAT-004`: The packaged Windows smoke verifies both first and second
  launches against the same profile.
- `AC-WINCAT-005`: A real Windows release runner provides the final platform
  evidence before a replacement prerelease is approved.
