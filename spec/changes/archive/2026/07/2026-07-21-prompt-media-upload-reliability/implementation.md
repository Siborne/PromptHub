# Implementation

## Status

Complete. The native image and video pickers now use the invoking Electron
window as their owner when available. Local image selection distinguishes a
quiet cancellation from unavailable bridge, rejected picker, and empty managed
copy failures, which now use the existing localized upload error.

The persistence contract remains unchanged:

- selected image bytes are copied immediately to
  `userData/data/assets/images/<uuid>.<extension>`;
- Prompt rows store the managed filenames as a JSON array in `prompts.images`;
- rendering uses `local-image://`; and
- portable backup/sync includes Prompt-referenced media under its existing
  contract.

## Test-First Evidence

Before implementation, the new regression suite failed five assertions: the
main process did not resolve or pass the sender window, and four image picker
failure modes produced no toast. The same tests passed after implementation.

## Verification

- Focused main/hook tests: 30 passed.
- Focused coverage run: 30 passed. The two legacy files report 75.57% aggregate
  statement coverage and 65.29% aggregate branch coverage; all new/changed
  conditions are exercised, including owned and parentless dialog calls,
  cancellation, success, unavailable APIs, rejection, empty copy results, and
  close-before-completion behavior. Uncovered lines are pre-existing unrelated
  download, paste, drag/drop, and media maintenance branches.
- Desktop TypeScript typecheck: passed.
- Targeted ESLint with zero warnings: passed.
- Desktop production build: passed. Existing Vite large-chunk and mixed
  `fflate` import warnings remain unrelated to this change.
- Manual current-runtime check after rebuilding and restarting the development
  instance: a physical click opened the image picker as an owned macOS form
  attached to PromptHub. The test dialog was canceled and no media file was
  selected or created.
- Prettier, `git diff --check`, spec index, and spec governance: passed.

## Convergence

`spec/knowledge/behavior/desktop.md` now records both the sender-owned picker
behavior and the existing filesystem/SQLite media ownership boundary. No data
layout, schema, IPC channel, sync payload, migration, or release behavior
changed.
