# Design

## Call Chain

- `AboutSettings -> preview enabled state copy`
- `SkillStore -> loadGitHubSkillRepo/loadStoreSource -> remote error banner`
- `CreateSkillModal -> loadGitHubSkillRepo -> shared rate-limit message`
- `CLISettings -> cli:status/cli:install -> cli-installer`

## Affected Modules

- `apps/desktop/src/renderer/components/settings/AboutSettings.tsx`
- `apps/desktop/src/renderer/components/skill/SkillStore.tsx`
- `apps/desktop/src/renderer/components/skill/CreateSkillModal.tsx`
- `apps/desktop/src/renderer/components/settings/CLISettings.tsx`
- `apps/desktop/src/main/services/cli-installer.ts`
- `apps/desktop/src/renderer/i18n/locales/*.json`
- related component tests

## Technical Approach

- Remove the heavy standalone amber warning block from the enabled preview-channel state and replace it with a lighter inline note that matches the setting-card rhythm.
- Keep the blocking confirmation modal as the primary high-salience warning moment.
- Introduce a dedicated remote-store rate-limit hint that recommends waiting and switching network instead of referencing a missing GitHub token setting.
- Improve the Skill Store error banner spacing and CTA layout so the primary error text and retry action do not feel cramped.
- Keep custom marketplace JSON sources that return `skills: []` as a successful load, but make the empty state explicitly say the registry contains zero skills and should be checked/refreshed.
- Before adding or saving a Marketplace JSON custom source, fetch the URL through the existing desktop remote-content bridge and validate that the response is JSON with at least one top-level `skills` entry or at least one nested reference under `marketplaces`, `sources`, or `registries`.
- Reject malformed JSON, invalid field shapes, and empty documents with localized toast copy; keep already-saved empty sources readable through the dedicated empty-state guidance.
- Disable CLI one-click install actions when desktop status cannot detect `pnpm` or `npm`, and keep a main-process guard that returns a stable error code instead of executing a missing package-manager command.

## Verification Plan

- Component tests for `AboutSettings`
- Remote-store tests for rate-limit error text
- Component test for empty custom marketplace JSON copy
- Service and component tests for Marketplace JSON validation before add/save
- Component test for CLI install controls with no detected package manager
- Desktop lint and targeted tests
