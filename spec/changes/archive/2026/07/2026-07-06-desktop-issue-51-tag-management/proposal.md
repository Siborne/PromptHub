# Proposal: Global Tag Management (Issue #51)

## Problem Statement
Currently, tags are attached to individual prompts as an array of strings (`tags` JSON array). There is no global registry of tags. Users cannot easily rename a tag across all prompts (e.g., fixing a typo from `reactjs` to `react`) or delete a obsolete tag globally. Issue #51 specifically requests the ability to modify and delete existing tags.

## Proposed Solution
1.  **Backend APIs (IPC & DB):**
    *   `prompt:getAllTags`: Aggregate and return all unique tags used across all prompts.
    *   `prompt:renameTag(oldTag, newTag)`: Find all prompts containing `oldTag`, replace it with `newTag`, and save. Update FTS index.
    *   `prompt:deleteTag(tag)`: Find all prompts containing `tag`, remove it from the array, and save. Update FTS index.
2.  **Frontend UI:**
    *   Introduce a **Tag Manager Modal**.
    *   Entry point: A new "Manage Tags" button in the Sidebar (near Folders/Tags section) or inside the Settings modal under a "Data" section. Given the context of folders, placing a small "gear" or "edit" icon next to the "Tags" section header in the sidebar would be highly discoverable.
    *   Modal provides a list of all tags, with "Rename" and "Delete" actions for each.
3.  **Sync/Backup Considerations:**
    *   Since renaming/deleting tags modifies the `prompts` table and increments `updated_at` / `current_version`, the standard WebDAV sync will automatically pick up the modified prompts as updates. No changes to the sync core are required, but `scheduleAllSaveSync` must be invoked after batch tag operations.

## Risks & Mitigations
*   **Performance:** Renaming a tag across thousands of prompts could be slow if done sequentially.
    *   *Mitigation:* Use a single SQLite transaction to update all affected prompts in the Main process.
*   **Concurrency:** Other syncs might happen during a batch tag rename.
    *   *Mitigation:* Use standard transactional updates in `prompt.ts`, ensuring versions are correctly bumped.

## Scope
*   Renderer: UI for Tag Manager, store methods for fetching tags.
*   Main/DB: SQLite aggregation for `getAllTags`, batch update logic for renaming and deleting tags.