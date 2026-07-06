# Design

## UX Structure

- `Sidebar` prompt tags section gear button remains the management entry point
- `GeneralSettings` gains a small "Behavior & Preferences" section with a tag click mode select
- no new top-level settings page is introduced

## Data Model

Prompt tags are currently aggregated from prompt JSON arrays. To support creating tags that are not yet attached to a prompt, desktop needs a persistent prompt tag catalog or equivalent durable store.

Implementation should prefer the smallest viable extension that does not disturb existing rename/delete semantics.

## Interaction Rules

- `single`: clicking a tag replaces the current `filterTags` array with only that tag, unless it is already the sole active tag, in which case it clears
- `multi`: clicking a tag preserves current toggle semantics

## Modules

- `apps/desktop/src/renderer/components/layout/Sidebar.tsx`
- `apps/desktop/src/renderer/components/prompt/TagManagerModal.tsx`
- `apps/desktop/src/renderer/components/settings/GeneralSettings.tsx`
- `apps/desktop/src/renderer/stores/settings.store.ts`
- prompt tag persistence path in desktop main/database/preload as needed

## Verification

- unit/integration tests for tag manager add/rename/delete flows
- sidebar tag click behavior in both single and multi preference modes
- lint passes
