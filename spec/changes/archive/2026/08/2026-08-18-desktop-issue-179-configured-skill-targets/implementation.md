# Implementation

## Status

Completed and converged. Stable behavior and the local GitHub issue overlay are
synchronized; remote issue closure remains governed by the release state and
does not keep the local implementation change active.

## Shipped

- Added optional `SkillPlatform.isConfigured` metadata for built-in Agent platforms with explicit user override settings.
- Main process `getSupportedPlatforms()` now marks configured built-in platforms and still appends enabled custom Agent platforms.
- Added renderer `filterDeployablePlatforms()` so distribution surfaces include detected platforms plus explicitly configured platforms while still honoring disabled platforms.
- Switched batch distribution, detail install, Skill list distribution badges, Agent view, Skill manager, and sidebar Agent count to the deployable platform visibility policy.
- Added regression coverage for configured custom Agents, configured built-in Agent overrides, disabled configured targets, and unconfigured undetected built-ins.
- Polished deploy-surface copy: empty state and default-selection hint now describe deployable targets rather than detection-only directories.
- Added direct unit coverage for `getConfiguredBuiltinAgentPlatformIds()`, including relative-path overrides and legacy root-path settings keys.

## Verification

- `pnpm --filter @prompthub/desktop test -- tests/unit/services/platform-visibility.test.ts tests/unit/services/platform-visibility-integration.test.ts tests/unit/main/skill-installer-platform.test.ts tests/unit/main/skill-installer-utils.test.ts tests/unit/components/skill-batch-deploy-dialog.test.tsx tests/unit/components/sidebar.test.tsx tests/unit/components/skill-agents-view.test.tsx tests/unit/components/skill-list-view-actions.test.tsx --run`
- `pnpm typecheck`
- `git diff --check`

## Synced Docs

- `spec/knowledge/behavior/skills.md`
- `spec/issues/active/local-github-status.md`

## Follow-ups

- The broader `/.agent` unified-root experience remains outside this bug fix.
