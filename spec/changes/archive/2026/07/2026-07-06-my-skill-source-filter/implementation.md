# Implementation

## Shipped

- Added a My Skills source filter dropdown in `SkillManager`.
- Source options are derived from the same source badge service used by gallery
  cards.
- Source filtering composes with existing library filters and resets pagination
  on change.
- Added `skill.sourceFilterLabel` and `skill.allSources` across all desktop
  locales.

## Verification

- Passed:
  `pnpm --filter @prompthub/desktop exec vitest run tests/unit/components/skill-i18n-smoke.test.tsx`
  - 1 file passed
  - 22 tests passed
- Passed: `pnpm --filter @prompthub/desktop typecheck`
- Passed:
  `pnpm --filter @prompthub/desktop exec eslint src/renderer/components/skill/SkillManager.tsx tests/unit/components/skill-i18n-smoke.test.tsx`
