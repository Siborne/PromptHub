# PromptHub 0.6.0-beta.2 Readiness

## Phase And Status

- Phase: implement
- Status: preparing
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

## Out Of Scope

- Creating or pushing `v0.6.0-beta.2`.
- Creating or publishing the GitHub prerelease or container images.
- Promoting `0.6.0` or moving any stable-facing download.
- Claiming packaged Windows, signed/notarized macOS, paid Provider, or public
  asset acceptance before the corresponding release jobs pass.

## Risks And Rollback

- A missed version source can produce mismatched artifacts; the repository
  version-alignment test covers all shipped manifests and the CLI runtime.
- The candidate includes storage, recovery, installer, updater, and Rules
  changes. Source checks do not replace packaged Windows two-launch, macOS
  signing/notarization, or updater-manifest verification.
- Before tagging, rollback is limited to reverting the version and release
  documentation batch. No user data or remote release state is changed here.
