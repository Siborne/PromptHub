# Implementation

## Status

Complete locally; GitHub issue #186 remains open pending a release.

## Source of Truth

- Agent platform metadata: `packages/shared/constants/platforms.ts`
- MCP library and target files: normalized PromptHub MCP library plus the
  target JSON file selected by each preset
- Rules index: `packages/shared/constants/rules.ts` and managed Rules files
- External evidence: ZCODE documentation for Skills, Agents, MCP, and Plugin

## Results

- Registered `zcode` across the shared Skills platform order, built-in Skill
  compatibility defaults, Rules templates, official ZCode mark, and MCP target
  kinds.
- Added global `~/.zcode/cli/config.json` and project
  `<project>/.zcode/config.json` MCP presets. ZCode entries are projected under
  `mcp.servers`, preserve unrelated settings, and retain `enable: false` on
  import.
- Added ZCode compatibility defaults for ClawHub and skills.sh catalog data.
- Kept ZCode Plugin distribution explicitly pending because the public docs do
  not confirm a stable local package marker or installation path.
- Updated the stable Agent platform, Rules, Plugin matrix, and local issue
  delivery records.

## Verification

- TDD red run reproduced the missing-platform, flat-MCP-shape, missing-preset,
  and disabled-import failures before implementation.
- `pnpm --filter @prompthub/shared typecheck`
- `pnpm --filter @prompthub/core exec tsc --noEmit`
- `pnpm --filter @prompthub/desktop typecheck`
- `pnpm --filter @prompthub/cli typecheck`
- Focused Desktop Vitest: 10 files, 106 tests passed (including Rules,
  platform, MCP, import, and icon coverage).
- `pnpm --filter @prompthub/core test`: 2 files, 16 tests passed.
- `pnpm --filter @prompthub/cli test -- --run`: 9 files, 86 tests passed.
- Focused Desktop ESLint passed with `--max-warnings 0`.
- `pnpm --filter @prompthub/desktop build`
- `git diff --check` passed for the change files.

## Known Boundary

ZCode Plugin bundle distribution remains pending because public docs do not
confirm a stable local package marker/path. Skills, Rules, and MCP support do
not depend on that unverified surface.
