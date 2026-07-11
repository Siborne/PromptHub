# Implementation

## Status

The replacement `v0.5.9` tag, Desktop release, and GHCR publication completed
successfully after the final release gate.

## Verification Plan

- `TEST-WEBREL-001`: a workflow-source regression asserts standard `v*`
  release tags produce semver and `latest` image metadata.
- `TEST-WEBREL-002`: GitHub Actions completes the standard `v*` workflow from
  the replacement `v0.5.9` tag.
- `TEST-WEBREL-003`: manifests, Docker build inputs, and `/health` use the
  root package version.

## Results

- Root, Desktop, Web, CLI, and Cloudflare Worker manifests already report
  `0.5.9`; Web client builds and `/health` derive that version from the root
  manifest.
- Remote workflow history confirmed the last successful tagged Web image was
  `web-v0.5.8`; `v0.5.9` did not match the `web-v*` trigger, leaving the
  published GHCR image behind the Desktop release.
- The workflow now follows standard `v*` release tags and emits `<version>`,
  `v<version>`, and `latest` GHCR tags.
- The replacement path deliberately uses `v0.5.9` itself; no `web-v0.5.9`
  compatibility or backfill tag is created.
- The deployment guide and version-reporting issue template now use the same
  release tag convention.
- The tagged Docker build exposed that the browser-safe Skill detail imports
  the shared core frontmatter parser while the image omitted the `packages/core`
  workspace package. Both build and runtime stages now install and copy that
  package so Docker resolves the same workspace export as local Web builds.
- The Web pull-request path filter now includes `packages/core/**`, ensuring
  future shared parser or workflow changes trigger the Docker image check.

## Verification

- The new workflow contract test failed before the workflow change because it
  found only the `web-v*` trigger, then passed with 2/2 tests.
- `apps/desktop/tests/unit/services/issue-version-label.test.ts` passed with
  5/5 tests.
- `ruby -ryaml -e "workflow = YAML.load_file('.github/workflows/web-self-hosted.yml'); abort('missing jobs') unless workflow['jobs'].is_a?(Hash)"` passed.
- `pnpm verify:web` passed lint, typecheck, tests, and production build.
- The final `pnpm verify:release` run passed all 22 checks in 333.9 seconds,
  including the SSR Web build after the explicit shared-utils alias was added.
  Tag publication remains pending.
- The local Docker daemon is unavailable on the release workstation, so the
  tag-triggered GitHub Actions Docker build is the required real-image
  verification after the correction. The original tagged image failure is
  retained as release evidence.
- The focused workflow/Dockerfile contract suite passes 2 tests after adding
  the Core package build/runtime copies and path trigger.
- GitHub Actions run `29154880396` completed the standard `v0.5.9` Web image
  build and publication successfully after the Docker workspace correction.
