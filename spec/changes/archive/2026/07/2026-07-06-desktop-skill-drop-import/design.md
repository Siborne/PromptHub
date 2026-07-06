# Design

## Summary

Add a skills-screen-only drag target that converts dropped file system entries into scan paths, then forwards them into `scanLocalPreview(customPaths)` and the existing `SkillScanPreview` modal.

## Modules

- `apps/desktop/src/preload/index.ts`
  - expose a safe helper for resolving local filesystem paths from dropped `File` objects using Electron `webUtils.getPathForFile`
- `apps/desktop/src/renderer/components/skill/SkillManager.tsx`
  - host the drag target UI and dropped-path normalization
  - call `scanLocalPreview(customPaths)` with the derived paths
- `apps/desktop/src/main/services/skill-installer.ts`
  - reuse existing custom-path preview scanning behavior

## Interaction Model

- drag handling is active only in the skills screen
- folders are scanned directly
- dropped markdown files resolve to their parent directory before scanning
- successful drops open the existing scan preview modal with selectable import results
- unsupported files show a toast instead of opening a new flow

## Validation

- unit tests for dropped path normalization and skills-screen drop handling
- targeted desktop lint + tests
