# Implementation

## Status

Implemented and visually accepted; awaiting publication.

## Implemented

- Added a transparent monochrome PromptHub layers source plus 16x16 72-dpi and
  32x32 144-dpi template PNG representations.
- Expanded the second draft to almost the full canvas and made the upper plate
  the dominant shape after the first running-app review found the mark too
  small.
- Extracted development and packaged path resolution plus template-image
  loading into `apps/desktop/src/main/tray-icon.ts`.
- Removed runtime resizing from the preferred macOS path so Electron/macOS can
  select the correct density representation.
- Added the tray asset directory to Electron Builder resources while retaining
  the previous application icon as a failure fallback.

## Verification

- `pnpm --filter @prompthub/desktop exec vitest run tests/unit/main/tray-icon.test.ts --coverage --coverage.include=src/main/tray-icon.ts --coverage.reporter=text`
  - 7 tests passed.
  - `tray-icon.ts`: 100% statements, branches, functions, and lines.
- `pnpm lint:file-size`: passed; the near-limit main entry shrank because tray
  policy moved to a focused module.
- `pnpm --filter @prompthub/desktop lint`: passed.
- `pnpm --filter @prompthub/desktop typecheck`: passed.
- `pnpm --filter @prompthub/desktop build`: passed.
- Packaged an unsigned local arm64 `.app`, verified all three tray resources
  under `Contents/Resources/tray`, launched the app with an isolated E2E user
  data directory, and exercised the real renderer-to-main minimize-to-tray
  entry through the preload bridge. No tray load error was emitted.
- First visual review: rejected because the artwork occupied too little of the
  status-item canvas. The revised source expands from approximately 12.5 points
  to 15.5 points wide and has a regression assertion for its canvas bounds.
- Second visual review: the enlarged top plate and full-canvas proportions were
  accepted in the running macOS menu bar.

## Convergence

- Synced the stable template-image, density-pair, no-runtime-resize, and product
  silhouette rules to `spec/knowledge/behavior/desktop.md`.
- No release note is added because the change has not yet been published.

## Static Audit

- Existing full application icons are intentionally retained for Dock and
  installer surfaces.
- The dedicated tray symbol is loaded only by the macOS branch.
- No renderer, IPC, database, network, sync, or user-input boundary is changed.
- Static search found no competing dedicated tray asset or loader.
