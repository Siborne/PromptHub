# Website Published Stable Delta

## Added Requirements

### `FR-WEBREL-001`: Explicit Published Stable Selection

Website release synchronization must use versions marked `stable record` in
`spec/releases/README.md`. Build versions, preparation records, prereleases,
and unreleased changelog content must not change public download metadata.

#### `AC-WEBREL-001`

When `0.6.0` is a preparation record and `0.5.9` is a stable record, generated
metadata remains on `0.5.9` even if a dated `0.6.0` changelog heading exists.

#### `AC-WEBREL-002`

When multiple stable records exist, the highest stable semver is selected.

#### `AC-WEBREL-003`

Missing stable records or a missing dated changelog heading for the selected
stable version fail explicitly.

### `NFR-WEBREL-001`: Bounded Deterministic Generation

Selection must use local repository inputs, linear scans, bounded working
memory, and no network calls.

## Verification

- `TEST-WEBREL-001`: preparation records cannot replace a stable record.
- `TEST-WEBREL-002`: major, minor, patch, lower, and duplicate semver paths
  select the highest stable record.
- `TEST-WEBREL-003`: missing stable records fail explicitly.
- `TEST-WEBREL-004`: stable records without a dated changelog entry fail
  explicitly.
- `TEST-WEBREL-005`: actual website synchronization retains `v0.5.9`.
