# Spec Delta: CLI Automation Contract

## Added Requirements

### `FR-CC-001`: Bounded success output

PromptHub CLI MUST accept `--quiet`, `--summary`, and `--full` as global options. Success output is summarized by default for Skill commands that otherwise include Skill bodies or complete file snapshots; explicit content-reading and export commands retain their payload semantics.

#### Scenario: Agent imports or snapshots a Skill

- **WHEN** `skill import`, `skill install`, `skill get`, `skill versions`, or `skill create-version` succeeds without `--full`
- **THEN** the result contains stable identity, version, fingerprint, and file-count metadata where applicable
- **AND** it does not contain `content`, `instructions`, or `filesSnapshot`.

#### Scenario: Caller controls verbosity

- **WHEN** `--quiet` is supplied
- **THEN** successful commands write nothing to stdout while failures remain on stderr
- **AND WHEN** `--full` is supplied
- **THEN** commands preserve the previous full payload.

### `FR-CC-002`: Intent-oriented Skill command names

PromptHub CLI MUST expose `skill import`, `skill distribute`, and `skill undistribute` as the preferred command names while retaining `install`, `install-md`, and `uninstall-md` as compatible aliases.

## Verification

- `TEST-CC-001`: CLI black-box tests cover flag placement, mutually exclusive verbosity flags, quiet errors, default summaries, and full compatibility payloads.
- `TEST-CC-002`: Alias tests prove preferred and legacy names produce the same durable DB/filesystem result.
