# Implementation

## Status

- Phase: converge
- Status: released in `v0.5.9`; verification and publication are complete

## Shipped

- Added built-in `kimi`, `reasonix`, and `augment` Skill platform metadata.
- Added `kimi`, `reasonix`, `augment`, `qoder`, and `qoderwork` to the default
  platform preference order.
- Added official Reasonix, Augment, and Kimi marks; retained distinct Lucide
  fallbacks so Kimi and Auggie do not render as duplicate sparkles.
- Added Kimi `~/.kimi/mcp.json` and Augment `~/.augment/settings.json` to the
  generic JSON MCP target registry; Reasonix remains excluded because its
  `[[plugins]]` TOML schema is not Codex-compatible.
- Added the documented Augment workspace target at
  `<workspace>/.augment/settings.json`; Kimi remains global because its current
  MCP documentation only defines `~/.kimi/mcp.json`.
- Extracted the MCP target preset registry into
  `packages/core/src/mcp-target-presets.ts` so the oversized legacy
  `mcp-library.ts` stays below the repository line-limit gate.
- Kept the single-file Rules registry unchanged for the new platforms.
- Updated `spec/knowledge/reference/agent-platforms.md` with current paths,
  asset ownership boundaries, and official evidence links.
- Collapsed built-in Agent Configuration detail panels by default; the compact
  row keeps the platform, status, and default root visible, while the header
  toggle reveals derived paths and Edit still opens the full form.
- Extracted the derived-path panel into `BuiltinAgentDetails.tsx` so the
  settings surface stays below the repository's preferred file-size limit.

## Verification

- `TEST-AGENT-PLATFORM-001`: `agent-root-paths.test.ts` covers Kimi paths and
  MCP preview.
- `TEST-AGENT-PLATFORM-002`: the same test covers Reasonix and Augment preview
  paths and the absence of synthetic global rules.
- `TEST-AGENT-PLATFORM-003`: `platform-icon.test.tsx` covers the official
  Reasonix, Augment, and Kimi marks; `agent-root-paths.test.ts` asserts that
  built-in platform ids, including `augment`, are unique.
- `TEST-AGENT-PLATFORM-004`: `mcp-library-codex-sync.test.ts` asserts the new
  ids have the correct MCP target boundary: Kimi and Augment are global JSON
  presets, while Reasonix is absent.
- `mcp-config.test.ts` covers the documented top-level `mcpServers` projection
  for both Kimi and Augment.
- Targeted desktop tests passed: 5 files, 54 tests, including Kimi/Augment
  `mcpServers` merge coverage and the workspace Augment target.
- Icon and registry regression tests passed: 2 files, 24 tests; Kimi and
  Augment now resolve to distinct official assets, and the built-in registry
  rejects duplicate platform ids.
- `skill-settings.test.tsx` passed: 15 tests, including compact-by-default
  rendering, accessible expand/collapse state, and Edit/Cancel behavior.
- Repository lint passed, including the file-size gate; the production desktop
  build passed after the settings refactor.
- The previously unrelated lifecycle type error was resolved before release;
  shared/core/DB/Desktop typechecks passed on the final release head.
- Repository lint passed: `pnpm lint` (including file-size and desktop ESLint
  gates).
- Desktop production build passed: `pnpm --filter @prompthub/desktop build`.
- Spec index generation and consistency checks passed: `pnpm spec:index` and
  `pnpm spec:index:check`.
- The complete Desktop suite later passed 359 files and 3,115 tests, including
  the locale-key and platform-target regressions.
- `v0.5.9` Desktop Build and Release run `29247235788` passed every target,
  including the macOS signing/notarization gates, and published the final
  platform assets on 2026-07-13.

## Analyze / Converge

- Analyze: complete; no unresolved design conflict.
- Converge: implementation, stable reference, lint, targeted/full tests,
  typecheck, production builds, and the published release agree.
