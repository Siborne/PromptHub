# Design

## Summary

Trace local-source registry entries back to disk on every update/reimport operation instead of trusting stale in-memory content. Ensure source-detail install actions reuse the same scanned-skill import path as the project/source list.

Extend the same local-source boundary with a My Skills link import mode. Copy mode continues to materialize a managed PromptHub package. Link mode stores the scanned local directory directly in `skills.local_repo_path` and treats that directory as the package source for file browsing, editing, and sync.

## Design Decisions

- `DES-001`: Local source updates and reimports resolve the current on-disk `SKILL.md` from the source directory instead of trusting stale cached registry content.
- `DES-002`: Scanned local imports expose copy/link mode on My Skills import surfaces, with copy as the default compatibility mode.
- `DES-003`: Linked local imports store the scanned external source directory in `skills.local_repo_path`; file browsing, editing, and sync use that path as the source of truth.
- `DES-004`: Missing linked external directories fail visibly and are not silently replaced with a managed copy; delete flows preserve external source directories.

## Modules

- `apps/desktop/src/renderer/stores/skill.store.ts`
  - local source resolution for update/install/reimport
  - installed skill matching for local sources
  - scanned local import mode branching: copy calls `saveToRepo`, link preserves the scanned local directory
- `apps/desktop/src/renderer/services/skill-store-update.ts`
  - update status computation for local source entries
- `apps/desktop/src/renderer/components/skill/SkillStoreDetail.tsx`
  - update/import action behavior for local source detail
- `apps/desktop/src/renderer/components/skill/ProjectSkillPreviewSidebar.tsx`
  - source detail import button integration
- `apps/desktop/src/renderer/components/skill/SkillScanPreview.tsx`
  - copy/link selector for scanned local imports
- `apps/desktop/src/renderer/components/skill/CreateSkillModal.tsx`
  - copy/link selector for local folder scan imports
- `apps/desktop/src/main/ipc/skill/shared.ts`
  - repo path resolution must preserve existing external `local_repo_path` values when they point to directories
- `apps/desktop/src/main/ipc/skill/local-repo-handlers.ts`
  - write/create/delete/rename handlers must resolve linked external repos instead of forcing managed repos

## Data Boundary

- No SQLite schema change is required.
- `skills.local_repo_path` remains the package path used by the desktop file editor and repo sync flows.
- For copy imports, `local_repo_path` points at a PromptHub-managed package path under the data Skills directory.
- For link imports, `local_repo_path` points at the scanned external Skill directory.
- `source_url` remains the scanned source path for source matching and user-facing source context.
- `directory_fingerprint` is computed from the imported source and refreshed from the active package path.

## Source-of-Truth Rules

- Copy import: PromptHub-managed package is the My Skills source of truth after import.
- Link import: external local directory is the My Skills source of truth after import.
- Existing external `local_repo_path` values that resolve to directories must not be auto-copied into managed storage by `ensureLocalRepoPath`.
- Missing external linked directories should return unresolved repo state instead of silently creating a managed copy from stale DB content.
- Delete flows may remove PromptHub-owned managed containers and distribution links, but must not delete non-managed external source directories.

## UI

- The scanned import surfaces expose a compact two-option selector:
  - `Copy`: standalone snapshot into My Skills.
  - `Link`: linked source directory that stays in sync with local edits.
- Copy is the default mode to preserve existing user expectations.
- The selector only affects local scanned imports into My Skills. Platform/project distribution keeps its existing copy/symlink controls.

## Validation

- `TEST-001`: regression tests covering local update, remove+reimport reads latest `SKILL.md`, and source-detail import button.
- `TEST-002`: regression tests covering linked scanned import preserving external `local_repo_path`.
- `TEST-003`: regression tests covering linked repo path resolution for read/write/sync flows.
- `TEST-004`: component tests covering the copy/link selector passing the selected import mode.
- `TEST-005`: targeted lint, typecheck, and desktop unit tests.
