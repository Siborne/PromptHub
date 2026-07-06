# Design: Global Tag Management (Issue #51)

## Scope
- Keep prompt global tag management intact.
- Extend the same interaction pattern to skills without introducing a second backend-only tag registry.

## Approach
- Reuse the existing `TagManagerModal` as a shared prompt/skill tag management modal.
- For prompts, keep the current dedicated IPC + DB batch operations.
- For skills, operate through the existing `useSkillStore.updateSkill()` path so tag edits continue to flow through the current skill update contract:
  - renderer state updates
  - desktop DB writes
  - `SKILL.md` frontmatter sync
  - web shared-renderer route compatibility

## Skill Tag Boundary
- Only manage user-editable skill tags.
- Do not expose imported/store-origin tags in the manager.
- Use the same user-tag derivation already used by the sidebar stats and skill forms.

## UI Adjustments
- Add the missing skill tag manager entry in the sidebar tag section.
- Increase row action affordance inside the tag manager so edit/delete controls remain visible and easier to hit.
