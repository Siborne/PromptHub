# Release Version Delta

## Added Requirements

### `FR-REL-001`: Product Version Alignment

The root monorepo and every shipped application distribution must report
`0.6.0` from its authoritative manifest.

#### `AC-REL-001`

Root, Desktop, CLI, self-hosted Web, Cloudflare Worker, Mobile package, and Expo
application manifests all report exactly `0.6.0`.

### `FR-REL-002`: Published Stable Isolation

Preparing `0.6.0` must not cause public website badges, introduction copy, or
download URLs to claim that `0.6.0` is published.

#### `AC-REL-002`

Website release synchronization selects the highest version explicitly marked
`stable record` in `spec/releases/README.md`, ignoring preparation records,
`[Unreleased]`, and prerelease entries.

#### `AC-REL-003`

Once `0.6.0` is marked as a stable record and has a matching dated changelog
entry, the same synchronization path selects `0.6.0`.

### `NFR-REL-001`: Deterministic Linear Selection

Release metadata selection must scan the release index and changelog linearly,
use bounded working memory, and fail explicitly when the published stable
record or its dated changelog entry is missing.

## Verification

- `TEST-REL-001`: assert all authoritative product manifests equal `0.6.0`.
- `TEST-REL-002`: assert a preparation record does not replace the published
  stable record.
- `TEST-REL-003`: assert the highest explicitly published stable semver is
  selected.
- `TEST-REL-004`: assert missing stable records and missing dated changelog
  entries fail explicitly.
- `TEST-REL-005`: run website synchronization and verify generated public
  metadata remains on the latest published stable version.
