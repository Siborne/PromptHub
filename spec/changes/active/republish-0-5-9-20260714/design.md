# 0.5.9 Replacement Release Design

## Decisions

- `DES-REPUB-001`: Treat the current verified `main` head as the sole source for
  the replacement annotated tag.
- `DES-REPUB-002`: Use existing GitHub Actions release workflows; do not upload
  locally built or unsigned artifacts.
- `DES-REPUB-003`: Preserve the stable version and release URL while explicitly
  documenting same-version updater semantics.

## Traceability

| Requirement | Design | Verification | Task |
| --- | --- | --- | --- |
| `FR-REPUB-001` | `DES-REPUB-001` | `TEST-REPUB-001` | `T-REPUB-001` |
| `FR-REPUB-002` | `DES-REPUB-002` | `TEST-REPUB-002` | `T-REPUB-002` |
| `FR-REPUB-003` | `DES-REPUB-003` | `TEST-REPUB-003` | `T-REPUB-003` |
| `NFR-REPUB-001` | `DES-REPUB-001` | `TEST-REPUB-001` | `T-REPUB-001` |

## Verification

- `TEST-REPUB-001`: Run `pnpm verify:release` before replacing the remote tag.
- `TEST-REPUB-002`: Wait for and inspect both tag workflow conclusions, release
  assets, update manifests, and container publication.
- `TEST-REPUB-003`: Inspect the changelog, generated website metadata, and stable
  release notes for the replacement and updater limitation.
