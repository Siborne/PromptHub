# Web Release Version Alignment Delta

## FR-WEBREL-001 Unified release publication

When PromptHub publishes a standard `v<version>` release tag, the
self-hosted Web workflow MUST publish the corresponding GHCR image tagged with
both `<version>` and `latest`.

The Docker build and runtime stages MUST include every workspace package used by
the Web client or server, and the pull-request workflow path filter MUST watch
those packages.

## FR-WEBREL-002 0.5.9 replacement publication

After the final release gate approves the replacement `0.5.9` release, the
`v0.5.9` tag MUST point to that finalized commit and the standard `v*` workflow
MUST publish the matching Web image under its semantic image tags. No
Web-only release tag is required.

## NFR-WEBREL-001 Release identity

The Web image version exposed by `/health` and the client build MUST be read
from the same root package version as the Desktop release.

## Acceptance Criteria

- `AC-WEBREL-001`: a `v0.5.9` release tag matches the workflow trigger and
  produces `0.5.9`, `v0.5.9`, and `latest` metadata tags.
- `AC-WEBREL-002`: the replacement `v0.5.9` tag triggers the standard Web
  workflow and publishes the image from the same finalized release commit.
- `AC-WEBREL-003`: source manifests and the Web health response continue to
  report `0.5.9`.
- `TEST-WEBREL-004`: workflow/Dockerfile coverage proves `packages/core` is
  included in image build/runtime stages and triggers the Web workflow.
