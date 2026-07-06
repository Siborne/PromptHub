# Proposal

## Why

Recent PR merges introduced two follow-up issues in the desktop app:

- `SkillInstaller` started importing a helper from `settings.ipc.ts`, which pulls `electron` into the CLI dependency graph.
- The renderer settings store now persists `githubToken` into zustand localStorage, expanding the secret exposure surface.

## Scope

- Move shared settings readers into an Electron-free main-process helper module.
- Keep `githubToken` out of renderer persisted storage while preserving the current settings UI.
- Re-sync renderer startup state from the main-process settings store during app boot.

## Risks

- Settings hydration order could regress startup behavior if main-process values are loaded too late.
- Token UI could appear blank if renderer no longer has a persisted fallback and main-process loading fails.

## Rollback

- Restore the previous imports in `skill-installer.ts`.
- Remove the main-process settings load during app boot.

## Impacted User Flows

- Opening desktop settings and editing the GitHub PAT.
- Launching the CLI binary.
- Starting the desktop app with startup behavior preferences already saved.
