# Design: Web Release Version Alignment

## Decisions

- `DES-WEBREL-001`: use the standard `v*` release-tag trigger and
  docker/metadata-action semver tags, matching Desktop's release identity.
- `DES-WEBREL-002`: retain `workflow_dispatch` for validation, but do not use
  an auxiliary tag to backfill `0.5.9`. After the final release gate passes,
  the replacement `v0.5.9` tag is updated to the finalized release commit;
  the standard `v*` trigger then publishes the matching GHCR image.
- `DES-WEBREL-003`: keep the Dockerfile's root-package version injection as
  the single runtime version source for client and `/health` responses.

## Traceability

| Requirement      | Design           | Verification      | Task           |
| ---------------- | ---------------- | ----------------- | -------------- |
| `FR-WEBREL-001`  | `DES-WEBREL-001` | `TEST-WEBREL-001` | `T-WEBREL-001` |
| `FR-WEBREL-002`  | `DES-WEBREL-002` | `TEST-WEBREL-002` | `T-WEBREL-002` |
| `NFR-WEBREL-001` | `DES-WEBREL-003` | `TEST-WEBREL-003` | `T-WEBREL-003` |
