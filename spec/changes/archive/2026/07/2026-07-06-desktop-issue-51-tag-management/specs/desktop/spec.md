# Desktop Spec Delta: Global Tag Management

## Modified Requirements

### Prompt and skill tag sections expose a consistent management affordance
- The desktop sidebar MUST expose a tag management entry for prompt tags and skill tags when the corresponding tag section is visible.

### Skill tag management only targets user-editable tags
- The desktop skill tag manager MUST list only user-editable skill tags.
- Imported or registry-origin tags that are treated as original metadata MUST NOT be listed as globally manageable skill tags.

### Global skill tag edits reuse the normal skill update path
- Renaming or deleting a skill tag from the global tag manager MUST update every affected skill through the existing skill update flow.
- The resulting skill data MUST remain compatible with downstream `SKILL.md` frontmatter syncing.
