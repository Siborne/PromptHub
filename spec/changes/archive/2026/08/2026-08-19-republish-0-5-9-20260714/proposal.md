# Republish PromptHub 0.5.9

## Why

The published `v0.5.9` artifacts predate the final Skill, MCP, Plugin, database,
updater, Cloud capability, and macOS menu fixes. New downloads must be rebuilt
from the corrected release head without changing the public stable version URL.

## Scope

- Replace the `v0.5.9` tag and GitHub Release after the full local gate passes.
- Rebuild Desktop/CLI release assets and the self-hosted Web image through the
  standard tag workflows.
- Synchronize release-facing records and generated website metadata.

## Risk And Rollback

Moving an already published tag changes the artifacts served to new downloads.
Rollback is to restore the previous peeled tag SHA and rerun the same workflows.
Installed `0.5.9` clients are unaffected because the updater requires a strictly
higher semantic version.
