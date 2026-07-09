# Proposal

## Why

GitHub issue #179 reports that users can add a custom Agent or change a built-in Agent root path in settings, but that Agent disappears from Skill distribution choices when the configured root directory does not already exist on disk.

This breaks the expected contract: a user-configured Agent is an explicit deployment target, and distribution already creates missing target directories. Platform detection should help avoid noisy default targets, not hide targets the user intentionally configured.

## Scope

- In scope:
  - Keep detected built-in platforms visible as before.
  - Always include enabled custom Agent platforms in Skill distribution and related Agent target surfaces.
  - Always include built-in platforms that have explicit user override metadata.
  - Continue honoring disabled platform settings.
  - Cover batch distribution, detail/quick install, list distribution badges, Agent scan views, and sidebar counts through one shared visibility policy.
- Out of scope:
  - Changing the meaning of absolute paths such as `/.agent` versus `~/.agent`.
  - Adding a new unified Agent root feature.
  - Closing the GitHub issue before a release containing this fix is published.

## Risks

- Showing configured-but-not-yet-created targets may make empty Agent scan pages appear. This is acceptable because the target was explicitly configured by the user.
- A too-broad inclusion rule could make default platforms noisy again. The fix must only include detected platforms or explicitly configured platforms.

## Rollback Thinking

The change is isolated to visibility metadata and renderer filtering. Rolling back restores the previous pure-detection filter and does not require data migration.
