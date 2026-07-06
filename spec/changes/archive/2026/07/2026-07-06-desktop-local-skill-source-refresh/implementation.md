# Implementation

## Status

Implementation landed and targeted verification passed. A follow-up linked local My Skills import pass also landed under the same local-source boundary.
Archived on 2026-07-06 after code, tests, and stable Skill docs were synced.

## Notes

- Traceability IDs were backfilled on 2026-07-06 after the project rules sync made `FR / DES / TEST / T` IDs explicit for touched active changes.
- issue #129 bundled three local-source regressions; the confirmed root causes were in local source path resolution and custom-path scanning behavior
- `SkillInstaller.collectSkillDirs()` previously skipped the scan root itself and only checked child directories, so a custom local source pointing directly at a skill folder would not rescan that folder's `SKILL.md`
- `resolveRegistrySkillContent()` previously treated `source_url` as the local repo directory when reading `SKILL.md`; if a local source entry stored `source_url` or `content_url` as `/path/to/SKILL.md`, updates would read the wrong location and fall back to stale cached content
- the same file-vs-directory ambiguity was also a latent risk in other local read paths: project detail rendering could pass a `.../SKILL.md` source path into `readLocalFileByPath(...)`, and the main-process repo access layer assumed the provided base path was always a directory
- the hardening pass now normalizes local skill directories in renderer code and also makes the main-process by-path repo helpers tolerant of receiving a `.../SKILL.md` file path as their base input
- the project/source detail `Import to My Skills` action already uses `handleImportProjectSkill() -> importScannedSkills()` correctly; a regression test now locks that interaction so future changes do not break it silently
- local scanned imports now expose copy/link mode controls in the scan preview modal and the create-skill local scan flow
- copy mode remains the default and calls `saveToRepo()` to materialize a PromptHub-managed package
- link mode creates the My Skills DB row with `local_repo_path` pointing at the scanned external source directory, records the scanned directory fingerprint, and skips managed repo materialization
- main-process repo path resolution now preserves existing external `local_repo_path` directories for read/write/sync flows instead of copying them into managed storage
- missing external linked source directories resolve as unavailable instead of silently creating a managed package from stale DB content
- stable Skill behavior and regression-matrix docs now describe My Skills copy/link source-of-truth semantics

## Verification

- `rg -o '\b(FR|DES|TEST|T)(-[A-Z]+)?-[0-9]{3}\b' spec/changes/archive/2026/07/2026-07-06-desktop-local-skill-source-refresh`
- `pnpm exec vitest run tests/unit/main/skill-installer.test.ts tests/unit/stores/skill.store.test.ts tests/unit/components/skill-projects-view.test.tsx`
- `pnpm exec vitest run tests/integration/components/skill-ui.integration.test.tsx tests/unit/main/skill-installer.test.ts tests/unit/stores/skill.store.test.ts tests/unit/components/skill-projects-view.test.tsx`
- `pnpm lint`
- `pnpm --dir apps/desktop exec vitest run tests/unit/stores/skill.store.test.ts tests/unit/main/skill-local-repo-shared.test.ts tests/unit/main/skill-local-repo-ipc.test.ts tests/unit/components/skill-i18n-smoke.test.tsx tests/unit/components/create-skill-modal.test.tsx`
- `pnpm --filter @prompthub/desktop typecheck`
- `pnpm --filter @prompthub/desktop lint`
