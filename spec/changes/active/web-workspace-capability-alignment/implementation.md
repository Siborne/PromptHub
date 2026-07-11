# Implementation

## Status

Implemented; release-harness convergence is complete pending publication.

## Verification Plan

- `TEST-WEB-CORE-001`: route tests prove authorized durable mutation and
  rejected invalid, inaccessible, cyclic, and malformed operations.
- `TEST-WEB-CORE-002`: bridge tests prove advanced Prompt calls use Web APIs.
- `TEST-WEB-CORE-003`: renderer tests prove Web only exposes browser-safe
  modules and capabilities.
- `TEST-WEB-CORE-004`: sync/backup tests prove agent asset snapshots persist.

## Delivered

- Added authenticated Web routes and service authorization for Prompt hierarchy
  moves, relations, output-format CRUD, and output-format ordering.
- Mapped the embedded renderer bridge to those routes, removing the Web-only
  IndexedDB fallback for hierarchy changes.
- Persisted Prompt `parentId` and `order` in workspace frontmatter. Workspace
  imports now restore parent-before-child records transactionally and reject a
  missing or cyclic hierarchy without partial data.
- Restricted the browser rail to Prompts, Skills, and Rules. Browser sessions
  persisted on MCP or Plugin now recover to Prompts.
- Disabled Desktop-only Skill capabilities in Web. Local filesystem, repository,
  scan, symlink, and platform bridge calls now reject instead of returning
  fabricated successful values.
- Updated deployment and stable behavior documentation with the browser-safe
  product boundary and opaque MCP/Plugin sync behavior.

## Verification Results

- `pnpm --filter @prompthub/web exec vitest run src/routes/prompt-advanced.test.ts src/services/prompt-workspace.test.ts src/client/desktop/install-bridge.test.ts src/client/desktop-runtime-capabilities.test.ts`: passed, 22 tests.
- `pnpm --filter @prompthub/desktop exec vitest run tests/unit/services/desktop-home-modules.test.ts tests/unit/stores/ui-columns.test.ts tests/unit/components/sidebar.test.tsx`: passed, 54 tests.
- `pnpm --filter @prompthub/web exec vitest run src/services/agent-assets-sync.test.ts src/services/sync-snapshot.test.ts --silent`: passed, 3 tests.
- Web lint and typecheck passed through `pnpm verify:web`; direct Vite client
  and server production builds passed.
- Browser verification against a temporary local Web deployment completed:
  authenticated workspace rendered with only Prompts, Skills, and Rules in the
  rail, no MCP/Plugin navigation, and no browser console errors.
- `pnpm --filter @prompthub/desktop typecheck` passed in the latest full
  release profile.
- The final `pnpm verify:release` profile passed all 22 checks in 333.9 seconds,
  including the Web production build and the browser-safe workspace contracts.
