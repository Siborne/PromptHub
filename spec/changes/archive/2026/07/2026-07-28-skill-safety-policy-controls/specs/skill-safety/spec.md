# Skill Safety Policy Delta

## Added Requirements

### FR-SAFETY-001 Global Automatic Scan Control

The Security settings surface must provide a global default for automatic
content safety scans before Skill Store installation and update.

#### Scenarios

- When enabled and no override applies, automatic content preflight and
  optional AI review run.
- When disabled and no override applies, automatic content preflight and AI
  review do not run.

### FR-SAFETY-002 Channel And Store Overrides

Users must be able to set `inherit`, `enabled`, or `disabled` for supported
source channels and exact built-in or custom stores.

Policy precedence must be:

1. exact store override
2. channel override
3. global default

Supported channels are official, community, Git repository, marketplace JSON,
and local directory.

#### Scenarios

- A disabled Gitea custom store skips content safety scans even when the global
  default is enabled.
- An enabled exact store scans even when its channel or global default is
  disabled.
- Removing an override restores inherited behavior.

### FR-SAFETY-003 Consistent Install And Update Enforcement

Quick install, detail install, batch install/update, source update, package
change recheck, and main-process package materialization must use the same
resolved policy.

The main process must receive an explicit scan mode for current renderer
requests. Missing mode remains compatible with the legacy mandatory preflight.

### FR-SAFETY-004 Manual Review Remains Available

Disabling automatic scanning must not remove manual scan actions for installed
or store Skills.

### NFR-SAFETY-001 Immutable Package Integrity

Policy controls must not bypass package materialization validation, including:

- safe relative paths and traversal prevention
- archive and symlink validation
- required root `SKILL.md`
- package depth, file-count, and size budgets
- package fingerprint generation and fingerprint-pinned approval

### NFR-SAFETY-002 Bounded Persistence

Persisted policy input must accept only known channel keys and valid enum
values. Store keys must be trimmed, length-bounded, deduplicated by map
identity, and capped at 512 entries.

## Modified Requirements

### Skill Store Installation Safety

The previous unconditional safety-scan requirement is replaced with
policy-aware automatic scanning. Package integrity validation remains
unconditional.

## Acceptance Criteria

- A custom Git/Gitea store can be set to `disabled` and install/update without
  invoking renderer or main-process content safety scans.
- An enabled store still blocks `blocked` reports and requires
  fingerprint-pinned approval for high-risk reports.
- The setting survives reload and malformed legacy data is normalized safely.
- All seven desktop locales contain the new user-facing copy.
