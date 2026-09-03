# 0.6.0-beta.2 Release Delta

## Requirements

### `FR-BETA2-001`: Candidate Identity

Every shipped PromptHub distribution and the standalone CLI runtime MUST report
`0.6.0-beta.2`.

#### `AC-BETA2-001`

The root, Desktop, CLI, self-hosted Web, Cloudflare Worker, Mobile package, Expo
application metadata, and CLI runtime all report the exact same prerelease.

### `FR-BETA2-002`: Stable And Preview Separation

Release documentation MUST identify beta.2 as a preview while stable-facing
downloads, website metadata, Homebrew guidance, and GHCR `latest` remain on
published stable `0.5.9`.

#### `AC-BETA2-002`

The localized README preview rows and release summaries identify beta.2, while
the generated website release constant and default downloads remain `0.5.9`.

### `FR-BETA2-003`: Publication Gate

The candidate MUST NOT be tagged or published until the full release profile,
packaged Windows two-launch gate, macOS signing/notarization checks, release
asset validation, and prerelease-only container tagging pass.

#### `AC-BETA2-003`

Local preparation records skipped platform and publication evidence explicitly;
the tag-triggered jobs remain the authority for those gates.

## Traceability

| Requirement    | Design          | Verification                       | Task          |
| -------------- | --------------- | ---------------------------------- | ------------- |
| `FR-BETA2-001` | `DES-BETA2-001` | `TEST-BETA2-001`, `TEST-BETA2-002` | `T-BETA2-001` |
| `FR-BETA2-002` | `DES-BETA2-002` | `TEST-BETA2-003`, `TEST-BETA2-004` | `T-BETA2-002` |
| `FR-BETA2-003` | `DES-BETA2-003` | `TEST-BETA2-005`, `TEST-BETA2-006` | `T-BETA2-003` |

## Verification

- `TEST-BETA2-001`: repository version-alignment test over all shipped
  manifests and Expo metadata.
- `TEST-BETA2-002`: standalone CLI `--version` regression.
- `TEST-BETA2-003`: localized README and changelog version audit.
- `TEST-BETA2-004`: website sync and stable `0.5.9` metadata assertion.
- `TEST-BETA2-005`: local quick and full release profiles.
- `TEST-BETA2-006`: tag-triggered platform, signing, packaged-startup, asset,
  updater-manifest, and container-tag verification.
