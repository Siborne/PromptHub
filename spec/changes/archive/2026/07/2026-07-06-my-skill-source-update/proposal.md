# My Skill Source Update

## Why

Skills imported from GitHub can carry enough source metadata to fetch their latest `SKILL.md`, but the My Skills detail view currently has no direct update action. Existing update logic is tied to store registry entries, so GitHub-imported skills without a cached store entry cannot be checked or updated from their own source.

## Scope

- Add a My Skills update path that starts from the installed skill id.
- Reuse existing registry update comparison semantics where possible.
- Preserve store update behavior for skills that still have registry or remote-store cache candidates.
- Surface check/update actions in the installed skill detail header.

## Non-Goals

- Full self-hosted Git diff/update support beyond existing registry metadata.
- Automatic background polling for all installed skills.
- Replacing local file sync conflict handling.

## Risks

- Source metadata may be incomplete or stale.
- GitHub tree URLs and raw URLs must be derived consistently to keep asset sync working.
- Local modifications must not be overwritten without an explicit overwrite path.
