# Spec Delta: Multi-Native Plugin Manifests

## Added Requirements

### `FR-PLUG190-001`: Discover all valid native target manifests

PromptHub MUST inspect every recognized native Plugin marker inside a package
and MUST report each independently validated target.

#### Scenario: Codex and Claude manifests coexist

- **GIVEN** one Plugin package containing valid
  `.codex-plugin/plugin.json` and `.claude-plugin/plugin.json`
- **WHEN** PromptHub scans or refreshes the package
- **THEN** Codex and Claude are both reported as native targets
- **AND** package identity remains stable across rescan.

### `FR-PLUG190-002`: Preserve target-native packages during distribution

When a selected target has a valid native marker, PromptHub MUST distribute the
package without replacing that marker with an adapter-generated manifest.

#### Scenario: Distribute the same package to Claude

- **GIVEN** a managed Plugin with a valid Claude native manifest
- **WHEN** the user distributes it to Claude
- **THEN** PromptHub preserves the native Claude manifest and package files
- **AND** the effective mode remains the requested copy or symlink mode when
  the existing target safety rules allow it.

### `FR-PLUG190-003`: Isolate malformed secondary manifests

A malformed native manifest MUST disable native handling only for its own
target. It MUST NOT invalidate other valid native targets or silently overwrite
the malformed marker through adapter generation.

#### Scenario: Claude marker is malformed

- **GIVEN** a package with a valid Codex manifest and malformed Claude manifest
- **WHEN** PromptHub scans the package
- **THEN** Codex remains valid and native
- **AND** Claude shows an actionable invalid-manifest warning
- **AND** Claude distribution is blocked until the marker is fixed or removed.

An escaping package symlink remains a package-wide security failure because
the package itself cannot be copied or linked safely.

### `NFR-PLUG190-001`: Bounded package inspection

Native marker discovery MUST inspect only the fixed marker allowlist and MUST
not recursively scan the repository for arbitrary manifest names.

#### Scenario: Large plugin repository

- **GIVEN** a package with many unrelated files
- **WHEN** native target evidence is refreshed
- **THEN** marker discovery performs a constant number of path checks
- **AND** manifest validation remains bounded by existing file and package
  limits.

## Modified Requirements

- `Native` versus `Adapter` is selected-Plugin evidence, not only a static
  platform capability label.

## Removed Requirements

- Codex is no longer the only target eligible for native package passthrough.

## Verification

- `TEST-PLUG190-001`: fixture with valid Codex and Claude markers returns both
  native targets and stable canonical identity.
- `TEST-PLUG190-002`: Claude distribution preserves the original native
  manifest and package fingerprint for copy and supported symlink mode.
- `TEST-PLUG190-003`: malformed/traversal/oversized secondary marker disables
  only its target and blocks adapter overwrite; escaping package symlinks fail
  the package boundary.
- `TEST-PLUG190-004`: update, rescan, snapshot restore, and batch aggregation
  keep per-target evidence correct.
- `TEST-PLUG190-005`: large package fixture proves marker discovery uses the
  fixed allowlist without recursive repository traversal.
