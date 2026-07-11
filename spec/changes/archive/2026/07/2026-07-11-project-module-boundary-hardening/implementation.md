# Implementation

## Status

Implementation, final release verification, and publication in `0.5.9` are complete.

## Current Inventory

- No non-generated source/test file exceeds 2,000 lines.
- 18 non-generated files are at or above 1,400 lines; six production files remain above the 1,500-line preferred threshold and are ratcheted in the baseline.
- Generated declaration files are excluded from the source-size policy.

## Implemented

- `pnpm lint:file-size` rejects new files above 1,500 lines, rejects every file above the 2,000-line hard limit, and prevents every recorded 1,500+ legacy file from growing.
- Skill boundary phase 1 extracted safety policy, source review/trust, translation cache, scan persistence, project normalization, and safety UI modules.
- Removed the unreachable 2,893-line legacy `AISettings.tsx` and its legacy-only component test. `SettingsPage` has routed exclusively to `AISettingsPrototype` since before this change; active AI settings store and IPC tests remain intact.
- Split the 2,122-line Web sync route suite into four behavior suites: route contracts, import/settings merge, filesystem safety/rollback, and WebDAV transport. Shared lifecycle/API harness and payload fixtures are isolated in two support modules; all resulting files are 646 lines or fewer.
- Extracted the Plugin core facade into domain modules for validation, marketplace/source resolution, persistence/versioning, distribution, and orchestration. The renderer Plugin manager and detail page now compose domain-owned views and controllers.
- Extracted the renderer shell, settings state, Skill store, MCP manager, Skill surfaces, and data settings into domain-owned modules while retaining their existing public contracts and persistence keys.
- Split all test suites that exceeded 2,000 lines by public behavior and isolated setup. Shared fixture modules contain setup only.
- Added a shared AI protocol resolver used by core, desktop renderer, and Web content workflows so endpoint derivation and authentication headers do not drift across products.
- Removed completed modules from the legacy baseline. The remaining baseline contains only current 1,500+ legacy production files and is ratcheted downward.
- Reduced function-level ownership in the refactored Plugin controller, MCP manager, Prompt workspace, Skill store/settings slices, Data Settings controller, and Create Skill flow. New state, lifecycle, action, and I/O hooks in those boundaries are at or below 50 lines.
- Repaired release verification regressions in the Skill batch-deploy test query and bounded staged-package source address verification. An unreachable self-hosted source now yields a provenance warning instead of consuming the full unit-test timeout.

## Retained Presentation Composition Roots

The following legacy presentation roots remain above the 50-line preferred limit. They route stable UI regions and retain no new durable policy or process-boundary behavior; focused component suites cover their current contracts.

- Skill views: `SkillStore.tsx`, `SkillFullDetailPage.tsx`, `SkillManager.tsx`, `SkillFileEditor.tsx`, `SkillProjectsView.tsx`, and `SkillSettings.tsx` compose established list/detail/editor sections. Store state, source updates, persistence, and safety decisions have moved to domain modules.
- Plugin views: `PluginManagerView.tsx`, `PluginFullDetailView.tsx`, `PluginAgentViews.tsx`, `PluginPlatformPanel.tsx`, and related detail/import panes compose library/store/Agent layouts. Controller state, target derivation, lifecycle effects, and actions have moved to focused hooks.
- Settings panels: backup and remote-sync panes retain their visual form composition, while runtime, path, recovery, backup, and provider side effects are owned by Data Settings controllers.
- Existing main, AI transport, and Web desktop-install bridge roots remain bounded legacy facades. They are not expanded by this change and remain subject to the 2,000-line hard limit and one-way baseline.

Further decomposition of a retained presentation root is required before adding behavior to that root.

## Prioritized Architecture Findings

1. Coordinate `PluginManager.tsx`, `plugin-library.ts`, and `PluginFullDetailPage.tsx` with `plugin-management`; split presentation first, then package validation/persistence/source/distribution behind the stable core facade.
2. Convert `settings.store.ts` and `skill.store.ts` into typed domain slices while retaining one persistence/composition root and preserving filesystem/DB rollback order.
3. Resolve the renderer/core/Web AI protocol source-of-truth conflict before splitting `ai.ts`; moving functions first would preserve duplicated behavior.
4. Split `DataSettings.tsx` by provider/recovery/danger workflows and `MainContent.tsx` by shell routing versus Prompt workflows.
5. Extract only stable Skill/MCP/Plugin library primitives such as grid sizing, drop zones, selection toolbars, and source editors; do not create one generic manager with incompatible domain semantics.

## Verification

- Web sync split: 4 files, 20 tests passed.
- AI settings active surface: 33 tests passed after legacy removal.
- Desktop and Web TypeScript typechecks passed.
- First Skill boundary batch: 127 focused tests, focused ESLint, and desktop production build passed.
- `pnpm lint:file-size` and `git diff --check` passed.
- Plugin core/UI: focused plugin and CLI suites, typecheck, build, lint, formatting, and file-size gate passed.
- Shell, settings, Skill, and MCP: focused suites, typecheck, build, lint, formatting, and file-size gate passed.
- AI protocol/content workflows: 8 core protocol tests, 67 desktop AI tests, and 10 Web skill-content tests passed.
- Function-boundary refactors: Plugin 45 tests, MCP 55 tests, shell/layout 69 tests, Create Skill Modal 19 tests, Skill/settings/source 192 tests, and Data Settings 30 tests passed in their focused suites.
- Source address timeout and remote Git package regression: 26 tests passed.
- `pnpm verify:release` passed all 22 checks in 333.9 seconds, including the
  2,000-line hard-limit gate and every maintained package surface.
