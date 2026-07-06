# Proposal

## Summary

Polish the desktop update/settings UI and the Skill Store remote-error experience so warning states remain readable, visually consistent, and actionable without misleading users.

## Why

- The current preview-channel warning block breaks the visual rhythm of the About settings page and looks crowded against adjacent setting rows.
- The Skill Store rate-limit error currently tells users to add a GitHub token in settings, but PromptHub does not provide that settings flow, which creates confusion.
- The About settings page also lacks direct community-entry points, forcing users to leave the app and search manually for Discord / QQ channels.
- Custom marketplace JSON sources can load successfully with zero skills, but the UI previously made this look like a generic search miss or unresolved loading state.
- Users can add a syntactically valid Marketplace JSON URL whose document contains no usable skills or nested registries, which then appears as `Loaded 0` after saving.
- CLI one-click install remained clickable when desktop could not detect `pnpm` or `npm`, producing raw package-manager command errors in the toast.

## Scope

### In Scope

- Refine the preview-channel enabled state presentation in the desktop About settings page.
- Improve remote-store error banner layout in Skill Store.
- Clarify the empty-state copy for successfully loaded custom stores that contain zero skills.
- Validate Marketplace JSON custom sources before add/save so empty or malformed registries are rejected with actionable copy.
- Replace misleading GitHub token guidance with actionable retry / network guidance.
- Add direct community entry links to the desktop About settings page.
- Guard CLI one-click install when no supported package manager is detected.

### Out Of Scope

- Adding GitHub token authentication support.
- Reworking the entire settings page layout.
- Changing CLI package distribution or release asset naming.
- Changing the public Marketplace JSON schema beyond existing `skills`, `marketplaces`, `sources`, and `registries` document shapes.

## Risks

- Tone changes in error messaging could reduce technical detail too much.
- UI polish could accidentally weaken warning visibility if over-softened.

## Rollback / Fallback

- Revert the presentation-only adjustments while keeping the preview-confirmation behavior intact.
