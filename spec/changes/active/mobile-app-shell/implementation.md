# Mobile App Shell Implementation

## Shipped

- Added `apps/mobile` as `@prompthub/mobile`, an Expo 57 React Native app using Expo Router.
- Replaced the generated sample tabs with PromptHub mobile tabs: Prompts, Skills, Store, and Settings.
- Added mobile-native feature boundaries under `src/features/*`.
- Added localized resources for the seven project locales.
- Added preview prompt and skill repositories that reuse `@prompthub/shared` types.
- Preserved the Skill package model by tracking both `packagePath` and `contentPath` in mobile Skill summaries.
- Generated a mobile visual direction with Image Gen before implementation:
  `/Users/lingxiaotian/.codex/generated_images/019cc0ea-e5fd-7171-aece-31d1b79cac88/ig_0e4203bd9a1a8c15016a4c77815db4819a8841a07a8f9ac6df.png`.
- Replaced the initial dark direction with a light/day-mode direction matching the desktop app reference:
  `/Users/lingxiaotian/.codex/generated_images/019cc0ea-e5fd-7171-aece-31d1b79cac88/ig_05e7fe10f1c373ff016a4c9838ff3c81998ac8c6c245ed4da2.png`.
- Reworked the shell UI into a PromptHub-style light workbench: pale gray app background, white cards, blue primary actions, compact search/filter dock, segmented filters, metric cards, dense work rows, row-level chips, and action affordances.
- Added root scripts for `dev:mobile`, `android:mobile`, `ios:mobile`, `web:mobile`, `typecheck:mobile`, and `test:mobile`.
- Added `/` redirect to the Prompt tab so the web/mobile entry has a valid root route.

## Verification

- `pnpm install --prefer-offline --ignore-scripts`
- `pnpm --filter @prompthub/mobile exec expo install --check`
- `pnpm --filter @prompthub/mobile typecheck`
- `pnpm --filter @prompthub/mobile test`
- `pnpm --filter @prompthub/mobile exec expo export --platform web --output-dir /tmp/prompthub-mobile-export`
- `EXPO_NO_TELEMETRY=1 pnpm --filter @prompthub/mobile exec expo start --web --port 19006`
- `curl -I --max-time 15 http://localhost:19006/prompts`
- `curl -I --max-time 15 http://localhost:19006/`
- Chrome/Playwright screenshot captured from `http://localhost:19006/prompts`:
  `/tmp/prompthub-mobile-prompts-v2.png`.
- Chrome/Playwright screenshots also captured for `http://localhost:19006/skills` and
  `http://localhost:19006/store`:
  `/tmp/prompthub-mobile-skills-v2.png`, `/tmp/prompthub-mobile-store-v2.png`.
- Chrome/Playwright light-mode screenshots captured for `http://localhost:19006/prompts`,
  `http://localhost:19006/skills`, and `http://localhost:19006/store`:
  `/tmp/prompthub-mobile-light-prompts.png`, `/tmp/prompthub-mobile-light-skills.png`,
  `/tmp/prompthub-mobile-light-store.png`.

## Synced Docs

- Added `spec/changes/active/mobile-app-shell/proposal.md`.
- Added `spec/changes/active/mobile-app-shell/design.md`.
- Added `spec/changes/active/mobile-app-shell/specs/mobile/spec.md`.
- Updated `spec/changes/active/mobile-app-shell/tasks.md`.

## Follow-ups

- Durable mobile SQLite persistence and Prompt create/edit flows moved to
  `spec/changes/active/mobile-prompt-persistence-hardening/` after the initial
  shell implementation was found to contain an undocumented first version.
- Skill package import and `SKILL.md` viewer.
- WebDAV/cloud sync on mobile.
