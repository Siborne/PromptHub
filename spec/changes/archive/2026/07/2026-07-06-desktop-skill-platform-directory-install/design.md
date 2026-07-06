# Design

## Summary

Shift platform deployment from a `SKILL.md`-only model to a managed-repo directory model across both desktop and core/CLI paths. The main desktop process and the shared CLI skill service should prefer the canonical managed repo for platform installs, copy entire filtered directory trees for copy installs, and create directory skeletons with per-entry symlinks for soft installs so PromptHub sidecars remain hidden. GitHub-backed registry installs should also sync full repo contents into the managed repo, using text writes for text files and byte-preserving writes for binary assets.

## Key Decisions

- keep the existing install IPC names to minimize renderer churn, but change their implementation to resolve and use the managed repo directory for the given skill name
- for copy installs, use a filtered recursive copy rooted at the managed repo, excluding `.git` and `.prompthub`
- for symlink installs, make the platform skill directory itself a directory symlink to the managed repo root so the entire skill folder remains the installation unit
- keep the remote GitHub tree-based sync, but replace the extension allow-list gate with a binary-safe fetch/write path so repository attachments survive import
- add repo-level write support for raw bytes via a new IPC path rather than overloading the existing string-only write API

## Affected Modules

- `apps/desktop/src/main/services/skill-installer-platform.ts`
- `apps/desktop/src/main/services/skill-installer-repo.ts`
- `apps/desktop/src/main/services/skill-installer-remote.ts`
- `apps/desktop/src/main/services/skill-installer.ts`
- `apps/desktop/src/main/ipc/skill/platform-handlers.ts`
- `apps/desktop/src/main/ipc/skill/local-repo-handlers.ts`
- `apps/desktop/src/main/ipc/skill/shared.ts`
- `apps/desktop/src/preload/api/skill.ts`
- `apps/desktop/src/renderer/components/skill/use-skill-platform.ts`
- `apps/desktop/src/renderer/services/skill-platform-sync.ts`
- `apps/desktop/src/renderer/stores/skill.store.ts`
- `packages/core/src/cli/skill-cli-service.ts`
- `packages/core/src/cli/run.ts`
- `packages/shared/constants/ipc-channels.ts`
- desktop and CLI regression tests for platform install behavior

## Validation Plan

- main platform installer test: copy installs copy nested assets and skip internal sidecars
- main platform installer test: symlink installs create a root directory symlink for the skill folder
- renderer skill store test: GitHub registry install writes binary files via byte-preserving API and still writes `SKILL.md`
- CLI regression test: `skill install-md` delegates directory-level platform installs rather than single-file deployment semantics
- targeted vitest runs for touched desktop main/store tests plus `pnpm lint`
