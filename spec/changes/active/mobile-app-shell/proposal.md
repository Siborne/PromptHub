# Mobile App Shell Proposal

## Why

PromptHub needs a mobile entry point for managing prompts and skills without carrying over desktop-only assumptions. The first mobile scope should establish an Expo React Native app under the existing monorepo so Android can be validated first while keeping iOS support viable.

## Scope

- In scope:
  - Add `apps/mobile` as a workspace app.
  - Scaffold an Expo Router shell with Prompt, Skill, Store, and Settings tabs.
  - Keep UI mobile-native and separate from desktop renderer components.
  - Reuse `@prompthub/shared` types where safe.
  - Add mobile-facing repository interfaces for prompt and skill data without implementing durable SQLite yet.
  - Add an initial unit test for mobile navigation metadata.
- Out of scope:
  - Production SQLite persistence.
  - WebDAV/cloud sync.
  - Desktop platform distribution such as installing skills into Claude Code, Codex, Cursor, or Windsurf.
  - MCP management.
  - Reusing desktop React components.

## Risks

- Expo and workspace package resolution can be sensitive in a pnpm monorepo.
- The existing `packages/db` package targets Node/Electron and is not React Native-ready.
- Skill semantics must preserve the package-directory contract, not regress to single-file-only behavior.

## Rollback Thinking

The change is isolated to `apps/mobile`, root workspace scripts, and this change record. Rollback can remove the mobile app directory and package scripts without affecting desktop, web, CLI, or existing shared packages.
