# Image Generation Workbench Sync Delta

## Scope

This delta defines the first-release exception to PromptHub's general `data/` sync
boundary for the Desktop image-generation workbench. It does not change existing Prompt,
Skill, Rule, MCP, Plugin, settings, or Prompt-referenced media sync behavior.

## MODIFIED Requirements

### `FR-IGW-015`: Generated Assets Remain Device-Local

Image-generation batches, attempts, output metadata, and original output files MUST NOT
be included in WebDAV, S3, self-hosted, or PromptHub cloud upload payloads in the first
release. Their presence under `data/` does not grant a sync provider permission to
upload them.

#### Scenario: Existing remote sync runs after a batch completes

Given a user has generated 100 local outputs
And an existing remote sync provider is enabled
When automatic or manual remote sync runs
Then the provider payload contains no generation manifest or generated original
And existing non-generation sync content is unchanged.

#### Scenario: User adds one output to a Prompt

Given a generated output exists only in the local workbench
When the user explicitly adds that output to a Prompt
Then the Prompt receives a normal Prompt media reference
And only that Prompt-referenced media follows the existing Prompt sync contract
And the source batch and its other outputs remain excluded.

### `NFR-IGW-SYNC-001`: No Accidental Directory Sweep

Remote payload construction MUST select supported records and Prompt-referenced media;
it MUST NOT recursively upload `data/generations/` or the compatibility-only
`data/assets/images/generated/` location. Tests MUST cover automatic sync, manual
provider upload, legacy payload building, and incremental manifest building.

## Future Boundary

Optional member cloud storage is not implied by this delta. It requires a separate
change defining entitlement, available quota, explicit per-user selection, upload and
download state, remote deletion, restore behavior, encryption/privacy, and downgrade
handling.
