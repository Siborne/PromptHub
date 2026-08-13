# 0.6.0-beta.1 Release Delta

## Requirements

### `FR-BETA1-001`: Prerelease identity

All shipped product manifests and runtime version surfaces must report
`0.6.0-beta.1`. Stable-facing badges, downloads, and default update behavior
must continue to target the latest published stable release.

### `FR-BETA1-002`: Release gate

The quick release profile must pass before the full release profile is run.
The full release profile must pass before tagging or publication.

### `FR-BETA1-003`: Preview record

The changelog and release index must identify `0.6.0-beta.1` as a published
preview release and must not describe it as the latest stable release.

### `NFR-BETA1-001`: Reproducibility

The candidate must be produced from an intentional, reviewable commit with no
untracked production files or unrelated uncommitted release inputs.

### `FR-BETA1-004`: CI portability

The tag-triggered release verification must execute the same complete gate on
the hosted Linux runner with explicit test configuration and without weakening
production secrets, runtime sandboxing, or platform-specific product behavior.

## Acceptance Scenarios

- `TEST-BETA1-001`: Exact version assertions pass for Root, Desktop, CLI,
  self-hosted Web, Worker, Mobile package, Expo metadata, and CLI runtime.
- `TEST-BETA1-002`: `pnpm verify:release:quick` exits successfully under the
  Node version used by release CI.
- `TEST-BETA1-003`: `pnpm verify:release` exits successfully under the Node
  version used by release CI.
- `TEST-BETA1-004`: Release records and generated website metadata preserve
  the stable public download target while adding the explicit beta candidate.
- `TEST-BETA1-005`: Release workflow produces required platform artifacts;
  macOS ZIP and DMG pass architecture, signature, notarization, and Gatekeeper
  checks before the draft prerelease is promoted.
