# Design — skill tag, visible at list glance without opening detail

Status: implemented on feat/my-skills-tag-search and committed with this change.

## Why the symptom happened (root cause)

Since the migration introduced on this branch, a skill’s SKILL.md frontmatter
(source) tags live in `original_tags`, while `skill.tags` holds the
user/DB-assigned tags. Two view surfaces diverged:

- The My Skills **list rows**（`SkillListView.tsx`）only rendered
  `skill.tags`.
- The **detail side surfaces**（`SkillPreviewPane.tsx`, skill editor and modal
  adapters）handle `original_tags` explicitly.

So an imported skill whose only tags are frontmatter ones showed **no tags in
the list**, and only surfaced them once a detail-related path involved
`original_tags`——exactly the reported “tags only appear after opening details”.

## Fix

In `SkillListView.tsx`, compute row-visible tags as a **de-duplicated union** of
`tags` + `original_tags`, truncated to the existing cap of 3, with explicit
per-row `normalizeStringArray(...)` handling. Filtering semantics and the
frontmatter-label filter setting are left untouched: this only makes an already
migrated tag visible in the row badge immediately after import.

Kept intentionally out of scope: `original_tags → filter candidates` remains
governed by the branch’s existing setting (`skillTagFilterIncludeFrontmatter`);
this change does not alter filter/tag-search behavior.
