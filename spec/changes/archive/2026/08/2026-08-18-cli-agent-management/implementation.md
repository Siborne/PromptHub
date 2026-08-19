# Implementation

## Status

Completed and converged. Agent registry management and read-only native
configuration inspection are implemented, documented, verified, committed, and
no longer have change-owned worktree edits. The 2026-08-18 lifecycle review
accepted the scoped verification limits as recorded follow-up harness debt.

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
- Added `agent config list` for bounded native configuration inventory, including declared files that do not exist yet.
- Added `agent config read` through the existing Core Agent configuration service, with secret redaction and revision metadata.
- Rejected absolute paths, traversal, excluded runtime/session paths, symlink targets, invalid roots, directories, oversized files, and paths outside the discovered configuration inventory.
- Kept native configuration inspection non-mutating; disabled Agents require explicit `--include-disabled` acknowledgement.
- Moved reusable Agent root/config normalization from renderer ownership into `packages/core/src/agent-management`; the renderer path remains a compatibility re-export.
- Added stable CLI Agent behavior documentation and updated all public README locale command tables.

### Verification Passed

- TDD baseline: the new native configuration regression initially failed because `agent config list` returned the usage error before the command existed.
- Direct local Vitest `apps/cli/tests/agent.test.ts` — 7 tests passed, including redaction, unchanged source content, disabled inclusion, missing files, traversal, excluded paths, symlink rejection, invalid roots/files, unsupported writes, and table/JSON output.
- Direct local Vitest CLI suite — 14 files / 123 tests passed.
- Direct local Vitest Core suite — 14 files / 122 tests passed.
- `pnpm --filter @prompthub/desktop exec vitest run tests/unit/renderer/agent-root-paths.test.ts` — 16 tests passed.
- Core and CLI typechecks passed for this extension.
- The CLI Vite build passed; the built `out/prompthub.cjs agent --help` entry was executed and showed both native configuration commands.
- Desktop ESLint passed with zero warnings.
- Traceability validation passed for all 23 active changes.
- Prettier check and `git diff --check` passed for the changed files.
- The Agent command, CLI help, and Agent CLI test files are 682, 377, and 758 lines; all remain below the 1000-line default.
- Targeted scan found no Electron import, process execution, or filesystem delete call in the new core/CLI Agent modules.

### Verification Limits And Existing Failures

- The repository's `pnpm` wrapper refused to execute because the pinned pnpm registry signature could not be verified. Verification used the installed local Vitest, TypeScript, and Vite binaries directly; no result is reported as a pnpm-wrapper pass.
- Focused V8 coverage could not run in the earlier Agent CLI slice because the CLI Vitest workspace cannot resolve `@vitest/coverage-v8`. Behavioral, branch, integration and adversarial tests were still run; installing/fixing the existing coverage provider remains a harness follow-up rather than being hidden as a pass.
- `pnpm lint:file-size` and the quick release profile remain red on three existing files outside this change: `SkillFileEditor.tsx` (1507), `SkillStore.tsx` (1536), and `SkillStoreDetail.tsx` (1536).
- The quick profile passed its CLI/Core/Shared/DB/Web/Worker/Mobile lint, typecheck and test checks, but the full Desktop unit aggregate reported 7 failing files / 11 failing tests while 511 files / 4580 tests passed. The failures are in the concurrent dirty Agent-workbench surface (capability expectations, Electron `safeStorage` mock, and UI interaction expectations); the scoped Agent root compatibility test and Desktop typecheck/lint passed.

### Residual Boundary

Native configuration inventory and redacted reads now use the shared Core service. Native configuration writes remain excluded until the CLI has an encrypted backup and secret-storage boundary. Provider Profile, session transcript, usage quota, appearance, native launch and package-manager lifecycle remain Electron-owned; CLI detail reports their shared capability status but does not claim or implement these deep adapters.
