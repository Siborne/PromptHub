# Spec Delta: Shared Global Agent Skills Target

## Added Requirements

### `FR-SKILL194-001`: Separate shared distribution target

PromptHub MUST expose an experimental shared Skill distribution target named
`agent-skills-global` without registering it as an Agent platform.

#### Scenario: User opens Skill distribution targets

- **GIVEN** the experimental target is available
- **WHEN** the user opens Skill distribution
- **THEN** the shared target is shown separately from Agent platforms
- **AND** Agent counts, detection, capabilities, roots, and settings remain
  unchanged.

### `FR-SKILL194-002`: Cross-platform path and override

The default shared target MUST resolve to the current user's `.agents/skills`
directory using platform-safe path APIs and MAY be overridden with a validated
absolute user-selected path.

#### Scenario: Resolve the default on each OS

- **GIVEN** a macOS, Linux, or Windows user home
- **WHEN** PromptHub resolves `agent-skills-global`
- **THEN** the result is `<home>/.agents/skills`
- **AND** no shell expansion, environment interpolation, or current-working-
  directory dependence is used.

### `FR-SKILL194-003`: Managed copy and symlink lifecycle

PromptHub MUST support copy and symlink installation, status, update, and
uninstall for the shared target. Every mutating operation MUST be backed by a
PromptHub ownership receipt.

#### Scenario: Install and uninstall a managed Skill

- **GIVEN** a valid managed Skill package and an empty target name
- **WHEN** the user installs and later uninstalls it
- **THEN** PromptHub records the effective mode, target path, source identity,
  and installed fingerprint
- **AND** uninstall removes only the receipt-owned target
- **AND** symlink uninstall removes the link, never the source package.

### `FR-SKILL194-004`: Protect unmanaged and modified targets

PromptHub MUST refuse silent overwrite or deletion when a target lacks a valid
receipt or its current fingerprint differs from the receipt.

#### Scenario: Existing directory is not PromptHub-managed

- **GIVEN** `<target>/<skill>` exists without a matching receipt
- **WHEN** install, update, or uninstall is requested
- **THEN** the operation returns an unmanaged conflict
- **AND** no target file is changed
- **AND** adoption or replacement requires an explicit reviewed action.

### `FR-SKILL194-005`: Detect duplicate discovery risk

PromptHub MUST detect exact-path duplicates and known runtime double-discovery
when the shared target and platform-specific targets are selected together.

#### Scenario: Shared and compatible platform targets are selected

- **GIVEN** the compatibility matrix records that an Agent scans the shared
  target and the user also selects its native target
- **WHEN** distribution is confirmed
- **THEN** PromptHub presents the duplicate-discovery risk before writing
- **AND** exact canonical-path duplicates are collapsed to one operation.

### `FR-SKILL194-006`: Evidence-backed compatibility

PromptHub MUST distinguish documented support from actual runtime verification
by Agent version, operating system, project/global scope, mode, and precedence.
Only runtime-verified combinations may be labeled compatible.

#### Scenario: Documentation exists but runtime is untested

- **GIVEN** official documentation mentions `~/.agents/skills`
- **WHEN** no recorded runtime fixture exists for an Agent/OS/version/mode
- **THEN** the matrix shows `documented` rather than `verified`
- **AND** the UI does not promise compatibility.

### `NFR-SKILL194-001`: Bounded and atomic lifecycle

Shared-target operations MUST use bounded package traversal, atomic receipt
writes, canonical path validation, and finite per-operation work.

#### Scenario: Large valid Skill package

- **GIVEN** a package at the existing Skill file/count/size limits
- **WHEN** it is copied or fingerprinted
- **THEN** PromptHub applies the existing bounded ignore and security policy
- **AND** publishes a receipt only after the target write and verification
  succeed
- **AND** failure leaves no receipt claiming a partial install.

## Modified Requirements

- Skill distribution target lists may contain both Agent platform targets and
  shared targets, but Agent Management remains platform-only.

## Removed Requirements

- None.

## Verification

- `TEST-SKILL194-001`: shared registry/UI/CLI tests prove the target does not
  enter `SKILL_PLATFORMS`, Agent counts, or capability matrices.
- `TEST-SKILL194-002`: table-driven path tests cover macOS, Linux, Windows,
  overrides, traversal-like input, null bytes, drive roots, and canonical
  duplicate paths.
- `TEST-SKILL194-003`: real filesystem lifecycle tests cover copy, symlink,
  Windows fallback, status, update, missing target, and safe uninstall.
- `TEST-SKILL194-004`: ownership/adversarial tests cover unmanaged targets,
  modified targets, forged/stale receipts, symlink escape, partial copy, and
  atomic receipt failure.
- `TEST-SKILL194-005`: selection tests cover exact-path deduplication and
  documented double-discovery warnings.
- `TEST-SKILL194-006`: maintained runtime matrix records Agent/OS/version,
  global/project discovery, copy/symlink loading, precedence, and observed
  result.
- `TEST-SKILL194-007`: stress test covers many Skills and target selections
  under existing package limits with bounded concurrency and resource cleanup.
