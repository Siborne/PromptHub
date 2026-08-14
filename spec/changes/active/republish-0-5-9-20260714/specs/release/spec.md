# 0.5.9 Replacement Release Delta

## Requirements

- `FR-REPUB-001`: New `0.5.9` downloads must contain all fixes present in the
  final verified release commit.
- `FR-REPUB-002`: Desktop assets, updater manifests, and the self-hosted Web image
  must be produced by the standard tag-triggered workflows.
- `FR-REPUB-003`: Public release notes must explain that a same-version replacement
  does not auto-update an already-installed `0.5.9` client.
- `NFR-REPUB-001`: The existing tag and release must not be replaced until
  `pnpm verify:release` passes.

## Acceptance Criteria

- `AC-REPUB-001`: The peeled remote `v0.5.9` tag resolves to the final release
  commit on `main`.
- `AC-REPUB-002`: Desktop Build and Release and Self-Hosted Web workflows pass.
- `AC-REPUB-003`: The stable Latest release exposes the expected platform assets
  and update manifests.
