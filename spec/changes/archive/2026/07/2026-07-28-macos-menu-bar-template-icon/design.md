# Design

## `DES-TRAY-001` Asset Design

Use a custom PromptHub layers glyph derived from the existing product mark,
but remove the blue rounded-square container, shadows, highlights, and other
full-size app-icon detail. The source is a small vector with black artwork on a
transparent canvas. Export it at 16x16 and 32x32 pixels as
`PromptHubStatusTemplate.png` and `PromptHubStatusTemplate@2x.png`.

The artwork occupies almost the full 16-point canvas. The top plate is the
largest uninterrupted shape and establishes the product silhouette; the two
lower layers retain enough separation to read at menu bar size. This avoids the
undersized appearance found during the first running-app review without
upscaling a small raster or exceeding the native status-item footprint.

An AI-generated bitmap is not appropriate for this surface: the symbol needs
deterministic geometry, transparency, exact pixel dimensions, and a stable
1x/2x relationship. SF Symbols provide useful platform conventions, but there
is no system PromptHub symbol; using the simplified product mark preserves
identity without misusing a generic system action glyph.

## `DES-TRAY-002` Loading Boundary

Extract macOS tray asset resolution and template loading from the near-limit
main-process entry file into `apps/desktop/src/main/tray-icon.ts`. The loader:

1. Resolves development assets from the desktop resources directory.
2. Resolves packaged assets from `process.resourcesPath`.
3. Loads the 1x filename whose adjacent `@2x` representation is discovered by
   Electron/macOS.
4. Marks the native image as a template image.
5. Does not resize the image at runtime, preserving the density pair.

The main process owns the fallback because it owns `Tray` lifecycle and logging.
Windows and Linux continue using the existing ICO path.

## Analyze Gate

- Source of truth: packaged desktop visual assets under
  `apps/desktop/resources/`; no database, settings, IPC, or renderer state.
- Existing docs do not define a competing macOS tray icon boundary.
- The current implementation and requested behavior agree that this is a
  desktop main-process platform integration concern.
- `FR-TRAY-001 -> DES-TRAY-001/DES-TRAY-002 -> TEST-TRAY-001..004 ->
T-TRAY-001..006` is complete with no unresolved material decision.

## Test Methods

- Black-box asset contract: verify shipped dimensions and package mapping.
- White-box branch coverage: development path, packaged path, successful load,
  and missing asset.
- Boundary/failure: missing preferred resource reaches the existing fallback.
- UI operation: inspect the running macOS menu bar after the automated gates.
- Security/performance/stress are omitted because the change loads fixed local
  resources and introduces no input, network, persistence, or repeated work.
