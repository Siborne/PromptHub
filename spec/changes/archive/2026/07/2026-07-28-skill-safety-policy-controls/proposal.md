# Skill Safety Policy Controls

## Status

- Phase: converge complete, ready to archive
- Owner: Desktop Skills
- Source of truth: renderer settings for policy; main-process package lifecycle for enforcement
- Related regression: `SR-004`

## Problem

Skill Store installation and update surfaces do not apply one consistent safety
policy. Quick install reads the global setting, while the detail flow invokes a
safety scan unconditionally and the main-process package lifecycle always runs
the deterministic content preflight. A user can therefore disable the visible
setting and still receive `SAFETY_SCAN_BLOCKED_*`, including for a managed
custom Gitea store.

The current setting is also too coarse. Teams need a global default with
exceptions for a source channel or one exact store.

## Goals

- Make automatic install and update safety scanning explicitly controllable.
- Resolve policy with the precedence `store override > channel override >
global default`.
- Support exact policies for built-in and custom stores, including Gitea-backed
  Git stores.
- Keep manual safety scan actions available.
- Keep non-optional package integrity controls active even when content safety
  scanning is disabled.
- Preserve existing settings during migration.

## Non-Goals

- Disabling path traversal, symlink, archive, required-file, size, or package
  fingerprint validation.
- Changing the safety finding model or AI provider configuration.
- Adding remote policy synchronization.
- Applying store-channel overrides to automatic scans of already-installed
  local Skills; that remains controlled by its existing independent switch.

## Risks And Rollback

- Disabling content safety scans increases the chance of importing malicious
  instructions or scripts. The UI must state this consequence at the point of
  configuration.
- An ambiguous missing IPC field could accidentally change legacy behavior.
  The package contract therefore carries an explicit `enabled` or `disabled`
  mode; missing mode preserves the legacy scan behavior.
- Rollback consists of removing the new policy fields and resolver while
  preserving the old global boolean. No database migration is involved.

## Capacity

Policy resolution is constant time. Persisted override maps are bounded to 512
store entries and known channel keys, so state size and render cost remain
bounded. Settings UI list work is linear in the small built-in/custom store
inventory.
