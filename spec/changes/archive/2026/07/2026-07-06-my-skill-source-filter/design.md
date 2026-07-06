# Design

## Source of Truth

Source filtering uses `buildMySkillSourceBadges()` from
`apps/desktop/src/renderer/services/skill-source-badges.ts`.

The dropdown uses the primary source badge, excluding branch badges, so variants
such as `dev` do not become separate source groups.

## UI

The dropdown is rendered in the My Skills filter row after the existing
All/Favorites/Distributed/Pending filters. It uses the shared `Select` component
instead of a native browser select.

## Data Impact

No SQLite, filesystem, IPC, preload, or settings schema changes.

## Compatibility

Existing libraries continue to work because source groups are derived from
existing skill fields:

- `source_id`
- `source_label`
- `source_url`
- `local_repo_path`
- `registry_slug`
- `installed_at`
- `is_builtin`
