# Implementation

## Status

Complete.

## Verification Plan

- Electron screenshot capture with the fixed Desktop viewport.
- Visual inspection of Prompt, Skill, MCP, Plugin, and Rules surfaces.
- Asset-reference scan across the root and localized README files.
- Relevant Desktop build and screenshot workflow checks.

## Results

- Extended `apps/desktop/scripts/capture-screenshots.mts` with deterministic
  MCP and Plugin fixtures. The records are created through the Desktop preload
  contracts before the corresponding modules are captured.
- Added a small screenshot plan with a unit test. The capture process now
  fails before Electron launches if the configured output surfaces drift from
  the README asset plan.
- Re-captured the nine README assets at 1440 x 900, including new dedicated
  `18-mcp-workspace.png` and `19-plugin-workspace.png` surfaces.
- Updated `README.md` and the six localized `docs/README.*.md` files to show
  accurately captioned Prompt, Skill, MCP, Plugin, and Rules workspaces.
- Kept `website/public/imgs/` unchanged because it is not a repository README
  surface.

## Verification

- `pnpm --filter @prompthub/desktop build`
- `node --experimental-strip-types scripts/capture-screenshots.mts` from
  `apps/desktop` with a clean temporary Electron profile; all nine assets
  were written successfully.
- `pnpm exec vitest run tests/unit/scripts/readme-screenshot-plan.test.ts`
- `pnpm exec eslint scripts/capture-screenshots.mts
  scripts/readme-screenshot-plan.mts
  tests/unit/scripts/readme-screenshot-plan.test.ts --max-warnings 0`
- `node --experimental-strip-types --check scripts/capture-screenshots.mts`
- `sips -g pixelWidth -g pixelHeight` confirmed every referenced README PNG
  is 1440 x 900; visual review confirmed populated MCP and Plugin workspace
  cards plus the Prompt, Skill, and Rules surfaces.
- `rg` confirmed every maintained README references both new MCP and Plugin
  assets with localized captions and alt text.

## Convergence

The capture plan, generated assets, and all maintained README sections now
agree on the same five Desktop modules. No release version or website asset
boundary changed.
