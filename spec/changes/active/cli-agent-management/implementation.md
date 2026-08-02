# Implementation

## Status

Review pending. Implementation, focused verification, stable documentation, and the available release checks are complete. The change remains active until maintainer review and intentional submission because the shared worktree also contains unrelated Agent-workbench edits.

## Source Of Truth

- Agent identity/platform definitions: shared platform registry.
- Agent capability depth: shared Agent capability inventory.
- Agent configuration: SQLite `settings` keys already used by desktop.
- Platform-owned runtime files remain external and are not mutated by registry commands.

## Verification Plan

- Black-box: CLI output and persisted/reloaded settings behavior.
- White-box/condition: filters, selectors, custom/built-in branches, enabled/disabled transitions, option combinations.
- Boundary/security: malformed relative paths, duplicate roots/ids, empty values, unknown/ambiguous selectors, built-in deletion.
- Failure/rollback: validation fails before the single settings transaction; assert unchanged reload state.
- Integration: real temporary SQLite database and temporary home directories.
- Performance: inventory is bounded by the platform registry/custom Agent setting list; no recursive filesystem traversal is introduced.

## Results

### Implemented

- Added the top-level `agent` CLI route and help surface.
- Added inventory/detail search and managed-Agent filters with explicit disabled inclusion and JSON/table output.
- Added built-in/custom enable and disable behavior using the desktop settings contract.
- Added custom Agent add/update/delete while preserving external roots.
- Added built-in/custom asset-path configuration and built-in reset.
- Added Codex/ChatGPT identity preference get/set without changing platform identity.
- Moved reusable Agent root/config normalization from renderer ownership into `packages/core/src/agent-management`; the renderer path remains a compatibility re-export.
- Added stable CLI Agent behavior documentation and updated all public README locale command tables.

### Verification Passed

- TDD baseline: `apps/cli/tests/agent.test.ts` initially failed all 4 initial cases because `agent` was not routed.
- `pnpm --filter @prompthub/cli exec vitest run tests/agent.test.ts` — 6 tests passed, including traversal/absolute/NUL/empty paths, duplicate id/root, ambiguous selection, mutation atomicity, disabled state, custom CRUD, identity and table output.
- `pnpm --filter @prompthub/cli test` — 14 files / 122 tests passed.
- `pnpm --filter @prompthub/core test` — 13 files / 112 tests passed.
- `pnpm --filter @prompthub/desktop exec vitest run tests/unit/renderer/agent-root-paths.test.ts` — 16 tests passed.
- Core, CLI and Desktop typechecks passed.
- `pnpm --filter @prompthub/cli build` passed; the built `out/prompthub.cjs agent --help` entry was executed successfully.
- Desktop ESLint passed with zero warnings.
- `pnpm spec:test` and traceability validation passed after refreshing `spec/changes/index.md`.
- Prettier check and `git diff --check` passed.
- New/changed Agent CLI source and test files are 215–565 lines; all remain below the 1000-line default.
- Targeted scan found no Electron import, process execution, or filesystem delete call in the new core/CLI Agent modules.

### Verification Limits And Existing Failures

- Focused V8 coverage could not run because the CLI Vitest workspace cannot resolve `@vitest/coverage-v8`. Behavioral, branch, integration and adversarial tests were still run; installing/fixing the existing coverage provider remains a harness follow-up rather than being hidden as a pass.
- `pnpm lint:file-size` and the quick release profile remain red on three existing files outside this change: `SkillFileEditor.tsx` (1507), `SkillStore.tsx` (1536), and `SkillStoreDetail.tsx` (1536).
- The quick profile passed its CLI/Core/Shared/DB/Web/Worker/Mobile lint, typecheck and test checks, but the full Desktop unit aggregate reported 7 failing files / 11 failing tests while 511 files / 4580 tests passed. The failures are in the concurrent dirty Agent-workbench surface (capability expectations, Electron `safeStorage` mock, and UI interaction expectations); the scoped Agent root compatibility test and Desktop typecheck/lint passed.

### Residual Boundary

Provider Profile, encrypted secret handling, session transcript, usage quota, appearance, native launch and package-manager lifecycle remain Electron-owned. CLI detail reports their shared capability status but does not claim or implement these deep adapters.
