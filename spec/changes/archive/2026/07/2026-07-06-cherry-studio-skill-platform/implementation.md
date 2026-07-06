# Implementation

## Changes

- Added Cherry Studio as a built-in skill platform in `packages/shared/constants/platforms.ts`.
- Set Cherry Studio default roots to:
  - macOS: `~/Library/Application Support/CherryStudioDev`
  - Windows: `%APPDATA%\CherryStudio`
  - Linux: `~/.config/CherryStudio`
- Set Cherry Studio skill path to `Data\Skills` under the platform root.
- Added a Cherry Studio-specific platform adapter:
  - copies the complete skill package into `Data/Skills/<folder>`
  - requires `cherrystudio.sqlite` to exist before install
  - detects Cherry Studio registry databases from `Data/agent.db`, `Data/agents.db`, or legacy `cherrystudio.sqlite`
  - upserts `agent_global_skill` with metadata parsed from `SKILL.md`
  - computes `content_hash` from `SKILL.md`
  - treats a copied folder without `agent_global_skill` registration as not installed
  - removes enabled-agent `.claude/skills/<folder>` symlinks on uninstall before deleting registry rows and files
- Routed Cherry Studio copy and symlink distribution requests through this adapter; symlink requests intentionally use copy semantics because Cherry Studio requires database registration.
- Added a Cherry Studio Lucide fallback icon in `PlatformIcon`.
- Updated platform path resolution so `%APPDATA%` uses the real `APPDATA` environment variable when available.
- Added Cherry Studio path and default-order regression coverage.
- Fixed Cherry Studio built-in Skill detection for installs whose registry lives in `Data/agent.db`.
  - Built-in status is still derived from Cherry Studio DB fields (`source='builtin'`, `builtin`, or `is_builtin`), not from hardcoded skill names.
  - Agent Skill cards show DB-marked built-ins as `External install` plus `Built-in` when they are not matched to My Skills; uninstall stays disabled in list and detail surfaces.
  - Deleting an imported My Skills entry with "delete copied distributions" still routes Cherry Studio cleanup through `uninstallCherryStudioSkill(...)`, so DB-marked built-ins reject deletion even when the user enters through the My Skills delete flow instead of Agent Skills.
- Fixed the AI Workbench capability helper type contract so typecheck can validate route capability filtering.
- Fixed AI Workbench capability checkbox handlers to read `event.currentTarget.checked`, which restored the full-suite capability-toggle regression.
- Synced the stable platform reference matrix in `spec/knowledge/reference/agent-platforms.md`.

## Verification

- `pnpm --filter @prompthub/desktop exec vitest run tests/unit/main/skill-installer-utils.test.ts tests/unit/components/use-skill-platform.test.ts`
  - Passed: 62 tests.
- `pnpm --filter @prompthub/desktop exec vitest run tests/unit/main/skill-installer-platform.test.ts tests/unit/main/skill-installer.test.ts tests/unit/components/skill-settings.test.tsx`
  - Passed: 175 tests.
- `pnpm --filter @prompthub/desktop lint`
  - Passed.
- `pnpm --filter @prompthub/desktop typecheck`
  - Passed after fixing the existing AI Workbench capability helper type mismatch.
- `pnpm --filter @prompthub/desktop exec vitest run tests/unit/services/ai-defaults.test.ts tests/unit/main/skill-installer-utils.test.ts tests/unit/components/use-skill-platform.test.ts tests/unit/main/skill-installer-platform.test.ts tests/unit/main/skill-installer.test.ts tests/unit/components/skill-settings.test.tsx`
  - Passed: 244 tests.
- `pnpm --filter @prompthub/desktop exec vitest run tests/unit/main/cherry-studio-skill-platform.test.ts tests/unit/main/skill-installer-platform.test.ts`
  - Passed: 19 tests.
  - Uses real temp SQLite and real filesystem fixtures for Cherry Studio registry behavior.
- `pnpm --filter @prompthub/desktop exec vitest run tests/unit/components/ai-workbench-base-fields.test.tsx`
  - Passed: 6 tests after fixing the capability checkbox handler.
- `pnpm --filter @prompthub/desktop test -- --run`
  - First rerun failed on `tests/unit/components/ai-workbench-base-fields.test.tsx`, exposing the stale checkbox-handler issue above.
  - Final rerun passed: 187 files, 1604 tests.
- `pnpm --filter @prompthub/desktop lint`
  - Passed after final changes.
- `pnpm --filter @prompthub/desktop typecheck`
  - Passed after final changes.

## Follow-Ups

- Replace the Lucide fallback with a dedicated Cherry Studio icon asset if the project later adds one.
- If PromptHub later needs per-agent Cherry Studio enable / disable management, it should write `agent_skill` and create / remove the per-workspace symlink using the same rules as Cherry Studio's `SkillService.toggle()`.
