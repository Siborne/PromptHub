# PromptHub 0.6.0-beta.2 Readiness

## Phase And Status

- Phase: converge
- Status: completed
- Primary requirement: `FR-BETA2-001`

## Why

`0.6.0-beta.1` is published and 33 non-merge commits have landed since its
tagged commit. A new prerelease identity is required so existing preview users
can receive the candidate through normal semver update discovery instead of
another same-version replacement.

## Scope

- Align every shipped distribution and the standalone CLI runtime to
  `0.6.0-beta.2`.
- Add the beta.2 changelog and release record, then synchronize the localized
  README preview surfaces and generated website changelog.
- Preserve `0.5.9` as the stable download, website, Homebrew, and GHCR
  `latest` identity.
- Run the quick release profile locally and record the full release profile as
  the mandatory pre-tag gate.
- After explicit publication authorization, create the beta.2 tag, run the
  platform release workflows, publish the GitHub prerelease, and preserve all
  stable-facing aliases.

## Out Of Scope

- Promoting `0.6.0` or moving any stable-facing download.
- Reopening or otherwise changing issue #211 remote state; the reporter already
  closed it after installing Git.
- Claiming packaged Git-less Windows UI or paid Provider acceptance without a
  real run.

## Risks And Rollback

- A missed version source can produce mismatched artifacts; the repository
  version-alignment test covers all shipped manifests and the CLI runtime.
- The candidate includes storage, recovery, installer, updater, and Rules
  changes. Source checks do not replace packaged Windows two-launch, macOS
  signing/notarization, or updater-manifest verification.
- Before publication, rollback is limited to keeping the generated GitHub
  release as a draft. After publication, withdrawal requires returning the
  release to draft without moving stable aliases.
