# Spec Delta: Skill Asset Topology

## Added Requirements

### `FR-ST-001`: Explicit Skill asset topology

PromptHub Desktop MUST show the upstream or external source, the current editable package, and detected distributed platform targets as separate topology stages.

#### Scenario: Managed remote Skill is distributed

- **GIVEN** a Skill has a remote source URL, a local managed package, and one or more platform installations
- **WHEN** the user opens Skill details
- **THEN** all three stages are visible together
- **AND** copy targets explain that redistribution overwrites them while symlink targets explain that edits follow the editable package.

#### Scenario: Linked local Skill

- **GIVEN** the external local directory is the content source of truth
- **WHEN** the topology is rendered
- **THEN** the editable package is labeled as linked external rather than a PromptHub-owned copy
- **AND** the UI does not imply that PromptHub may overwrite the external source.

## Verification

- `TEST-ST-001`: Component tests cover remote managed, local linked, undistributed, copy, symlink, and mixed distribution states.
- `TEST-ST-002`: Desktop UI is exercised in light and dark themes at desktop and narrow content widths with no clipped or overlapping topology text.
