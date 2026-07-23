# Design

## Current Source Of Truth

- Media bytes: `userData/data/assets/images/` and
  `userData/data/assets/videos/`, resolved through runtime path helpers. Legacy
  top-level directories remain compatibility inputs.
- Prompt references: the SQLite `prompts.images` and `prompts.videos` TEXT
  columns contain JSON arrays of managed filenames.
- Rendering: the renderer converts managed filenames to the `local-image://` or
  `local-video://` protocol.
- Sync/backup: only Prompt-referenced media participates in the existing portable
  media contract.

No source of truth changes in this work.

## DES-PMU-001 Sender-Owned Dialog

`image.ipc.ts` will resolve `BrowserWindow.fromWebContents(event.sender)` for
image and video picker calls. A shared helper calls Electron's two-argument
`showOpenDialog(parent, options)` overload when possible and its one-argument
fallback otherwise. This keeps focus and modality tied to the requesting window
without creating global window state.

## DES-PMU-002 Failure Classification

`usePromptMediaManager` will treat an empty path list as user cancellation. Once
paths exist, an unavailable save bridge, an empty managed-copy result, or an
exception is a failure and uses the existing `prompt.uploadFailed` translation.
Async results still respect the existing mounted/open guards.

## Data, Security, And Recovery

- No schema, payload, path, or migration changes.
- The existing selected-path allowlist in the main process remains authoritative.
- The picker still limits selectable extensions and the copy path still assigns
  UUID filenames.
- Partial per-file copy behavior is unchanged; any successfully returned managed
  filenames remain visible, while a completely empty result is reported.

## Complexity

Window ownership resolution is O(1). Selection handling remains O(n) for n
selected paths and does not add file reads, network requests, or unbounded
concurrency.

## Traceability

- FR-PMU-001 -> DES-PMU-001 -> TEST-PMU-001 -> T-PMU-001
- FR-PMU-002 -> DES-PMU-002 -> TEST-PMU-002 -> T-PMU-002
- NFR-PMU-001 -> DES-PMU-001/DES-PMU-002 -> TEST-PMU-001/TEST-PMU-002 -> T-PMU-003
