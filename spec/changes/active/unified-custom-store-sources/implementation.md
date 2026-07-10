# Implementation Log

## Status

Implemented.

## Shipped

- Added shared renderer-side custom store source helpers in
  `apps/desktop/src/renderer/services/custom-store-source.ts`.
  - Normalizes source input, shared add/update/remove/toggle flows, and
    built-in/custom source merge behavior.
  - Adapts the shared source shape into Skill, MCP, and Plugin store source
    records instead of duplicating store-specific CRUD logic.
- Gated Skill custom-source deletion behind an in-app confirmation dialog.
  - `SkillStore` now requests deletion first, then removes the source only
    after explicit confirmation.
  - `SkillStoreCustomSources` no longer performs immediate destructive
    deletion from the sidebar row action.
- Added shared type-option support to `SkillStoreSourceEditModal` so MCP and
  Plugin stores can reuse the same edit surface without forking the modal.
- Added MCP custom store source state, persistence, and sidebar/store flow.
  - `mcp.store.ts` now persists `customStoreSources` and
    `selectedMarketSourceId`.
  - Built-in MCP market sources merge with enabled custom sources through the
    shared adapter.
  - MCP Store source loading skips remote reload for the built-in official
    source and treats custom sources as first-class channel entries.
- Added Plugin custom store source state, persistence, and source override
  flow.
  - `plugin.store.ts` now persists custom sources and selected source id.
  - Plugin renderer requests can pass the current merged source list into
    preview/install IPC calls, so custom marketplace entries resolve against
    the same source list shown in UI.
  - `CorePluginLibraryService` now accepts optional source overrides for list,
    preview, and install operations instead of assuming only built-in sources.
- Unified store naming around the PromptHub-maintained built-in channel.
  - MCP and Plugin sidebars now display `Official Store` /
    `官方商店` for the PromptHub-maintained built-in source while keeping
    underlying provenance and source metadata intact.
  - Sidebar source lists for MCP and Plugin now include a dedicated
    `添加商店` / `Add store` entry that routes users into the shared custom
    source creation flow.
- Resolved GitHub #167 by exposing the existing store-local search control for
  selected custom Skill Store sources.
  - Marketplace JSON, Git repository, and local-directory sources reuse
    `storeSearchQuery` and `filterRegistrySkills` against their loaded catalog.
  - Searching keeps the selected source unchanged and does not add a custom
    remote query contract.

## Verification

- `pnpm --filter @prompthub/desktop test -- --run tests/unit/components/skill-store-custom-sources.test.tsx tests/unit/components/mcp-manager.test.tsx tests/unit/components/plugin-manager.test.tsx tests/unit/components/sidebar.test.tsx tests/unit/components/skill-settings.test.tsx tests/unit/components/use-skill-platform.test.ts tests/unit/main/mcp-library.test.ts tests/unit/main/plugin-library.test.ts tests/unit/main/skill-installer-utils.test.ts tests/unit/services/mcp-remote-store.test.ts`
  - Result: passed (10 files, 243 tests).
- `pnpm --filter @prompthub/desktop typecheck`
  - Result: passed.
- `pnpm --filter @prompthub/desktop exec vitest run tests/unit/main/plugin-target-inventory.test.ts tests/unit/services/skill-store-search.test.ts tests/unit/components/skill-store-custom-sources.test.tsx tests/unit/components/skill-store-remote.test.tsx`
  - Result: passed (4 files, 114 tests), including all three custom Skill Store source types and the existing built-in search behavior.
- `pnpm --filter @prompthub/desktop lint`
  - Result: passed.
- `pnpm --filter @prompthub/desktop exec vitest run tests/unit`
  - Result: passed on the confirmation run (288 files, 2,804 tests).
- `pnpm verify:release:quick`
  - Result: did not complete. The first desktop-unit pass reported five
    transient UI-test failures under full-suite load; the affected tests and
    the complete desktop unit suite passed on immediate reruns. The remaining
    quick-harness steps were not reached.
- `git diff --check`
  - Result: passed.
