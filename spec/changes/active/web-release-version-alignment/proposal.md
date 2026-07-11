# Web Release Version Alignment

## Purpose

Ensure the self-hosted Web container is published for the same `v<version>`
release tag used by the Desktop distribution.

## Scope

- Publish future Web images from standard PromptHub release tags.
- Keep GHCR semantic version and `latest` tags aligned with the release.
- Replace the `0.5.9` container image from the finalized replacement release
  commit using the standard `v0.5.9` tag.

## Risk And Rollback

The workflow changes only tag-triggered publishing. The one-time replacement
updates the public `v0.5.9` tag only after the final release gate passes, so
the existing `v*` workflow publishes the matching Web image without an
auxiliary Web-only tag. Rolling back the replacement requires restoring the
previous release tag and rerunning the same workflow.
