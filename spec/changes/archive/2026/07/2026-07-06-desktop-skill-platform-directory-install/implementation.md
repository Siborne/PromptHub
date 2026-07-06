# Implementation

## Status

Implementation landed and targeted verification passed.

## Notes

- platform copy installs now resolve the managed local repo for the skill and recursively copy the full filtered directory into the target platform skill folder instead of writing only `SKILL.md`
- symlink installs now create a root directory symlink from the platform skill folder to the managed repo, matching the requirement that the whole skill folder is the installation unit
- symlink installs now return structured install results so renderer flows can distinguish real symlink success from copy fallback; fallback installs surface warning toasts with per-platform reasons instead of looking like a normal symlink success
- added binary-safe remote asset sync for GitHub-backed registry installs by introducing raw-byte fetch and local repo write IPC paths; non-`SKILL.md` files now sync as bytes instead of UTF-8 text
- kept existing renderer install flows and IPC names intact to minimize surface-area churn; the behavioral shift happens behind the same desktop APIs
- extended the same directory-level install rule into `packages/core/src/cli/skill-cli-service.ts`, so CLI `skill install-md` now deploys the managed repo directory instead of writing a single platform `SKILL.md`
- tightened GitHub repository URL installs in both desktop and core/CLI so `local_repo_path` resolves to the unique directory that contains `SKILL.md`; repository roots with multiple skill directories are now rejected instead of being treated as one skill

## Verification

- `pnpm --filter @prompthub/desktop exec vitest run tests/unit/main/skill-installer-platform.test.ts tests/unit/stores/skill.store.test.ts`
- `pnpm --filter @prompthub/desktop exec vitest run tests/unit/main/skill-installer-platform.test.ts`
- `pnpm --filter @prompthub/desktop exec vitest run tests/unit/main/skill-installer-platform.test.ts tests/unit/stores/skill.store.test.ts tests/unit/main/skill-installer.test.ts -t "installFromGithub|skill-installer-platform symlink install|syncs binary GitHub repo assets"`
- `pnpm --filter @prompthub/desktop exec vitest run tests/unit/main/skill-installer-platform.test.ts tests/unit/services/skill-platform-sync.test.ts tests/unit/components/skill-i18n-smoke.test.tsx`
- `pnpm --filter @prompthub/cli exec vitest run tests/run.test.ts -t "reports skill platform status and delegates install-md or uninstall-md|installs platform skills as full directories instead of only SKILL.md"`
- `pnpm --filter @prompthub/cli exec vitest run tests/run.test.ts -t "installs a github skill with injected git clone|installs only the nested directory that contains SKILL.md from a github repo|rejects github repo install when multiple skill directories are found"`
- `pnpm lint`
