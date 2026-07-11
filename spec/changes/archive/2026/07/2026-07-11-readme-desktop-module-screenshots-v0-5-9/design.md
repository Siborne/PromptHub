# Design

## DES-README-SHOT-001 Capture ownership

`apps/desktop/scripts/capture-screenshots.mts` remains the single screenshot
capture entry point. It will add MCP and Plugin surfaces and write assets under
`docs/imgs/` at the existing 1440 x 900 viewport.

## DES-README-SHOT-002 Representative state

The capture workflow will seed or create representative MCP and Plugin library
records through their existing Desktop contracts before navigating to each
module. It will not use browser/Web bridges or fabricated renderer-only state.

## DES-README-SHOT-003 Documentation routing

The root `README.md` and six localized `docs/README.*.md` files will share the
same asset list. `website/public/imgs/` remains unchanged because it is not a
repository README surface.

## Verification

| Requirement | Design | Test / Evidence | Task |
| --- | --- | --- | --- |
| `FR-README-SHOT-001` | `DES-README-SHOT-001/002` | Electron capture and visual review | `T-README-SHOT-001/002` |
| `FR-README-SHOT-002` | `DES-README-SHOT-001/002` | Capture exit status and PNG inspection | `T-README-SHOT-001/003` |
| `NFR-README-SHOT-001` | `DES-README-SHOT-003` | README asset-reference scan | `T-README-SHOT-004` |
