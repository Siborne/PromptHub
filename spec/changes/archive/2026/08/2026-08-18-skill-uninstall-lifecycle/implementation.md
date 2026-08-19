# Implementation

## Changes

- Full skill detail page global platform uninstall now opens a destructive confirmation dialog before calling the platform uninstall action.
- Platform install status now exposes detailed copy/symlink mode via `skill:getMdInstallStatusDetails`.
- The platform uninstall confirmation explains the actual install mode:
  - copy install: remove the platform copy
  - symlink install: remove only the link
- PromptHub library delete confirmation is conditional:
  - undistributed skills only show the library deletion message
  - copy distributions show an opt-in checkbox to also delete copied distributions
  - symlink distributions show that links will be deleted directly
- `skill:delete` now accepts `removeCopyInstallations`; copied distributions can be preserved, while symlink distributions are still removed.
- Project target paths can be inspected with `skill:getLocalPathStatus`, allowing PromptHub deletion to remove project symlinks while keeping project copies by default.
- Skill detail project distribution now lists already distributed project targets and can remove those project skill folders.
- `scanLocalPreview()` now treats top-level symlink directories under a scan root as skill directory candidates when the symlink target is a directory. This fixes project skills installed by symlink mode not appearing in the Project Skills tab after rescan.
- Added a CRUD lifecycle matrix to the design record covering PromptHub library, global platform, and project target scopes across copy/symlink materialization.
- Added service-level regression coverage for project symlink update/read behavior: after the source `SKILL.md` changes, project scan reads the updated content through the symlink.
- Added service-level regression coverage for project symlink uninstall behavior: removing the project skill path deletes only the symlink and preserves the source directory.
- Added `skill.platformUninstallHint` to all seven locales and updated `skill.deleteHint`; new conditional strings use i18n keys with fallback text.
- Added/extended regression tests for:
  - `uninstallSkillMdForSkill()` removing only the platform target path
  - platform status details distinguishing copy vs symlink
  - `skill:delete` preserving copy distributions while removing symlink distributions
  - full detail platform uninstall requiring confirmation
  - undistributed delete not showing distribution cleanup warnings
  - copied delete passing `removeCopyInstallations: false`
  - symlink delete showing direct deletion warning
  - PromptHub deletion removing project symlink distributions
  - detail project distribution removal via `deleteLocalFileByPath(localPath, ".")`
  - project scan discovery for symlink-installed project skills
  - project symlink scan reflecting source edits
  - project symlink removal preserving the source skill directory

## White-box Audit

- Confirmed the previous lifecycle matrix was incomplete because it did not explicitly include the project `Read / Scan / Visibility` path.
- Confirmed project symlink lifecycle is now covered at service level for create, read/scan, update-by-source-change, and delete-link-only behavior.
- Confirmed copy distributions are snapshot semantics. They are not expected to update automatically from PromptHub after source edits; users must redistribute/overwrite when they want a copy target refreshed.
- Confirmed global platform uninstall removes only the platform target and clears activation state; PromptHub source directories are not removed by the platform uninstall path.
- Documented the remaining partial area: a full PromptHub-library CRUD matrix covering DB record lifecycle, managed repo lifecycle, version history, external repo sync, and distribution side effects belongs in a separate broader certification pass if needed.

## Verification

- `pnpm --filter @prompthub/desktop exec vitest run tests/unit/main/skill-installer.test.ts -t "symlink project skill"`
  - Result: passed, 2/2 matched tests.
- `pnpm --filter @prompthub/desktop exec vitest run tests/unit/main/skill-installer.test.ts tests/unit/main/skill-installer-platform.test.ts tests/unit/main/skill-crud-ipc.test.ts tests/unit/components/skill-projects-view.test.tsx tests/unit/components/skill-detail-project-distribution.test.tsx`
  - Result: passed, 197/197.
- `pnpm --filter @prompthub/desktop exec vitest run tests/unit/main/skill-installer.test.ts -t "discovers project skills installed as symlink directories"`
  - Result: failed before the fix with `expected [] to have a length of 1`; passed after the fix.
- `pnpm --filter @prompthub/desktop exec vitest run tests/unit/main/skill-installer.test.ts tests/unit/main/skill-installer-repo.test.ts tests/unit/stores/skill.store.test.ts tests/unit/components/skill-projects-view.test.tsx tests/unit/components/skill-detail-project-distribution.test.tsx`
  - Result: passed, 225/225.
- `pnpm --filter @prompthub/desktop exec vitest run`
  - Result: failed, 1528/1553 passed. Remaining failures are outside the project symlink scan path and include stale settings-store mocks missing `AI_SCENARIO_MODEL_ROUTE`, stale `SKILL_LIST_PAGE_SIZE_OPTIONS` mocks, existing skill-filter/stat expectations, skill-platform-sync field-name expectations, one skill DB duplicate-column test, and the official-store empty-state copy expectation.
- `pnpm --filter @prompthub/desktop exec vitest run tests/unit/main/skill-installer-platform.test.ts tests/unit/main/skill-crud-ipc.test.ts tests/unit/components/skill-detail-project-distribution.test.tsx tests/unit/components/skill-projects-view.test.tsx`
  - Result: passed, 41/41.
- `pnpm --filter @prompthub/desktop exec vitest run tests/unit/main/skill-installer-platform.test.ts tests/unit/main/skill-crud-ipc.test.ts tests/unit/components/skill-detail-project-distribution.test.tsx`
  - Result: passed, 32/32.
- `pnpm --filter @prompthub/desktop exec vitest run tests/unit/components/skill-detail-project-distribution.test.tsx`
  - Result: passed, 15/15.
- `pnpm --filter @prompthub/desktop typecheck`
  - Result: passed.
- `pnpm --filter @prompthub/desktop exec eslint src/main/services/skill-installer.ts tests/unit/main/skill-installer.test.ts`
  - Result: passed.
- `pnpm --filter @prompthub/desktop exec eslint src/main/services/skill-installer-platform.ts src/main/services/skill-installer-repo.ts src/main/ipc/skill/crud-handlers.ts src/main/ipc/skill/platform-handlers.ts src/main/ipc/skill/local-repo-handlers.ts src/preload/api/skill.ts src/renderer/components/skill/SkillFullDetailPage.tsx src/renderer/components/skill/SkillManager.tsx src/renderer/components/skill/SkillPlatformPanel.tsx src/renderer/components/skill/use-skill-platform.ts tests/unit/main/skill-installer-platform.test.ts tests/unit/main/skill-crud-ipc.test.ts tests/unit/components/skill-detail-project-distribution.test.tsx`
  - Result: passed.
- `pnpm --filter @prompthub/desktop exec eslint src/renderer/components/skill/SkillFullDetailPage.tsx src/renderer/components/skill/SkillManager.tsx tests/unit/main/skill-installer-platform.test.ts tests/unit/main/skill-crud-ipc.test.ts tests/unit/components/skill-detail-project-distribution.test.tsx tests/unit/components/skill-projects-view.test.tsx`
  - Result: passed.
- `node -e 'for (const f of ["en","zh","zh-TW","ja","fr","de","es"]) JSON.parse(require("fs").readFileSync("apps/desktop/src/renderer/i18n/locales/" + f + ".json", "utf8")); console.log("locale json ok")'`
  - Result: passed.
- `pnpm --filter @prompthub/desktop exec vitest run tests/unit/components/skill-i18n-smoke.test.tsx -t "keeps all locale skill keys aligned with english"`
  - Result: passed, 1/1.

## Lifecycle Disposition (2026-08-18)

Status: completed. The only unchecked item asks whether a broader library CRUD
matrix should become a separate follow-up. That optional future scope is not an
unfinished task in this change.
