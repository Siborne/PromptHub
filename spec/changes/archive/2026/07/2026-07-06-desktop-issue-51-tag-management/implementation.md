# Implementation: Global Tag Management (Issue #51)

## Shipped
- Reworked `TagManagerModal` so the same modal can manage prompt tags and skill tags.
- Added a missing manage-tags entry to the skill sidebar tag section.
- Kept skill tag writes on the existing `updateSkill()` path instead of introducing a separate skill tag IPC surface.
- Limited skill tag management to user tags, excluding imported/store-origin tags.
- Increased action button hit area and visibility inside the tag manager list rows.
- Added a desktop component regression test covering skill tag rename behavior.

## Verification
- `pnpm --filter @prompthub/desktop test -- tests/unit/components/tag-manager-modal.test.tsx tests/unit/components/sidebar.test.tsx --run`
- `pnpm --filter @prompthub/desktop typecheck`
- `pnpm --filter @prompthub/desktop lint`
