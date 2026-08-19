# Design

## Current Behavior

- Global platform installs live at `<platformSkillsDir>/<skillName>`.
- Copy installs materialize a standalone directory snapshot.
- Symlink installs materialize a directory symlink at the same target path.
- `uninstallSkillMdForSkill()` removes the platform target directory and clears activation state.
- PromptHub library deletion calls `uninstallSkillMdForSkill()` for every supported platform, then deletes only PromptHub-managed containers.
- Project-local removal calls `deleteLocalFileByPath(scannedSkill.localPath, ".")`, which removes the selected project skill folder. If that folder is a symlink, the symlink is removed, not the target source.

## Changes

- Full detail page platform uninstall becomes a confirm-first flow.
- Platform install status has a detailed mode shape:
  - `copy` means a standalone platform/project folder exists.
  - `symlink` means the platform/project folder points back to the PromptHub source.
- Project-local target paths can be inspected with the same copy/symlink distinction before PromptHub library deletion.
- PromptHub library deletion accepts an explicit copy-cleanup option:
  - Symlink distributions are always removed because keeping them would leave links back to a deleted or unmanaged PromptHub entry.
  - Copy distributions are optional; the UI defaults to keeping them unless the user opts into deleting copied distributions.
  - This applies to global platform distributions and scanned project target distributions that PromptHub can identify.
- Delete confirmation text is conditional:
  - Undistributed skills only show a PromptHub-library deletion message.
  - Copy distributions show a checkbox asking whether copied Agent/project folders should also be deleted.
  - Symlink distributions show a direct-deletion warning.
- Skill detail project distribution lists already distributed target folders and can remove them from the selected project.
- Project scans follow top-level symlink skill directories under scan roots such as `.agents/skills/<skillName>` so symlink-distributed project skills appear in the Project Skills tab. Internal symlinks inside a skill package remain filtered by the repo file walker.
- Tests assert durable operations rather than only UI labels.

## CRUD Lifecycle Matrix

This matrix is the white-box checklist for skill lifecycle paths. A cell is only marked covered when the behavior maps to a concrete implementation path and regression test.

| Scope | Materialization | Create / Install | Read / Scan / Status | Update / Sync | Delete / Uninstall |
| --- | --- | --- | --- | --- | --- |
| PromptHub library | managed `repo/` container | Covered by import/create paths that materialize managed repos via `skill-installer-repo.ts`; outside this change's main blast radius. | Partially covered by repo file listing/detail paths and store loading. Needs separate full-library CRUD matrix if this change expands beyond distribution lifecycle. | Partially covered by repo write + version/sync paths. Copy/symlink distribution update semantics are tracked in target rows below. | Covered for managed containers by `deleteManagedVariantContainer()` during `skill:delete`; external original folders are not deleted. |
| Global platform | copy | Covered: `installSkillMdForSkill()` copies the canonical repo into `<platformSkillsDir>/<skillName>`. Test: `skill-installer-platform.test.ts`. | Covered: `getSkillMdInstallStatusDetailsForSkill()` reports installed copy only when activation belongs to the same skill id. Test: `skill-installer-platform.test.ts`. | Partial by design: copy installs are snapshots. Rename update redeploys and removes legacy names in `crud-handlers.ts`; normal content edits require explicit reinstall/redistribution. | Covered: `uninstallSkillMdForSkill()` removes only the platform target and clears activation. PromptHub source is preserved. |
| Global platform | symlink | Covered: `installSkillMdSymlinkForSkill()` links the platform target to the canonical PromptHub repo and records activation. Test: `skill-installer-platform.test.ts`. | Covered: status details detect `mode: "symlink"` via `lstat()` plus activation ownership. Test: `skill-installer-platform.test.ts`. | Covered by filesystem semantics: platform reads the linked PromptHub repo. Explicit content-update UI regression is still lower priority than project scan because platform apps read the link directly. | Covered: same uninstall path removes the platform target link only and clears activation. Test asserts the PromptHub source is not removed. |
| Project target | copy | Covered: `copyRepoByPathToDirectory(..., { mode: "copy" })` creates `<targetRoot>/<skillName>` and UI calls it from project distribution. Tests: `skill-installer.test.ts`, `skill-projects-view.test.tsx`, `skill-detail-project-distribution.test.tsx`. | Covered for normal directories by `scanLocalPreview()` / `collectSkillDirs()` and project scan state. | Covered as snapshot semantics: copy targets do not live-sync from PromptHub; redistributing/overwrite is required to update the project copy. | Covered: project removal calls `deleteLocalFileByPath(localPath, ".")`; PromptHub library deletion preserves project copies by default and removes them only when the user opts in. |
| Project target | symlink | Covered: `copyRepoByPathToDirectory(..., { mode: "symlink" })` creates `<targetRoot>/<skillName>` as a directory symlink. Test: `skill-installer.test.ts`. | Covered after the missed bug fix: `collectSkillDirs()` follows top-level and one-level nested symlink directories that point to real directories, so Project Skills displays symlink-installed skills. Test: `discovers project skills installed as symlink directories`. | Covered by new regression: after changing the PromptHub/source `SKILL.md`, `scanLocalPreview()` reads the updated description/instructions through the project symlink. | Covered by new regression: `deleteLocalRepoFileByPath(localPath, ".")` removes the project symlink while preserving the PromptHub/source directory. |

## White-box Findings

- Previous matrix missed the project `Read / Scan / Visibility` path for symlink installs. The fix is in `SkillInstaller.collectSkillDirs()`, not only the UI.
- Project symlink lifecycle now has service-level coverage for create, read after source update, and delete-link-only behavior.
- Copy targets are intentionally detached snapshots. The product must not promise automatic propagation for copied global/project distributions unless a later change adds explicit sync/overwrite behavior.
- The remaining partial area is a broader PromptHub-library CRUD matrix covering DB record, managed repo, version history, external repo sync, and distribution side effects together. This change now documents that boundary instead of implying full lifecycle coverage.

## Verification

- Main platform service: uninstall removes only platform target and clears activation.
- Main platform service: status details report copy vs symlink install modes for active platform installs.
- Main CRUD IPC: library deletion can preserve copy distributions while still removing symlink distributions.
- Project UI: remove from project calls deletion on the scanned project skill directory from the detail distribution panel, and PromptHub library deletion removes project symlink distributions while preserving project copies by default.
- Project scan: a symlinked project skill under `.agents/skills` is discovered by `scanLocalPreview()` with the symlink path as `localPath`.
- Project scan: a symlinked project skill reflects source `SKILL.md` edits when rescanned.
- Project uninstall: removing a symlinked project skill deletes the project link and keeps the PromptHub/source directory.
- Detail UI: installed global platform uninstall opens a confirmation dialog before calling uninstall.
