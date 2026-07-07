# Design

## `DES-ICON-001` QClaw Mapping

`apps/desktop/src/renderer/components/ui/PlatformIcon.tsx` imports `qclaw.png` and maps platform id `qclaw` to that asset. This keeps QClaw separate from the existing `openclaw` mapping.

## `DES-ICON-002` WorkBuddy Mapping

`PlatformIcon.tsx` imports `workbuddy.svg` and maps platform id `workbuddy` to that asset. WorkBuddy is already present in the shared platform matrix and MCP target tests; this change only fills the renderer icon gap.

## `DES-ICON-003` TRAE Variant Mapping

The TRAE family platform ids continue to share `trae.png`. Current Work and CN variants do not introduce a separate accepted icon contract in this change.

## Data, IPC, And Persistence Impact

- SQLite schema: none.
- Filesystem runtime layout: none.
- IPC or preload contracts: none.
- Shared platform constants: none.
- Renderer assets: adds `qclaw.png` and `workbuddy.svg`.

## Verification Mapping

| Design | Verification |
| --- | --- |
| `DES-ICON-001` | `TEST-ICON-001` |
| `DES-ICON-002` | `TEST-ICON-002` |
| `DES-ICON-003` | `TEST-ICON-003` |
