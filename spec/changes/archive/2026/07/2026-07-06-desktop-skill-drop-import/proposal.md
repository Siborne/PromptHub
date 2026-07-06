# Proposal

## Why

Issue #120 asks for a faster skill import flow in the desktop app: users should be able to drag a folder or markdown file into the skills screen and let PromptHub recognize importable skills automatically.

## Scope

- add drag-and-drop import affordance in the skills screen only
- accept dropped folders, `SKILL.md`, and fallback markdown files such as `README.md`
- reuse the existing local skill scan preview and import flow instead of creating a second import path

## Risks

- drag-and-drop must not interfere with prompt/folder drag interactions outside the skills screen
- dropped files need reliable local path resolution in Electron 33+

## Rollback

- remove the skills-screen drag target and path resolution bridge
- keep existing local scan button flow untouched

## Impacted User Flows

- import a skill by dragging a folder into the skills screen
- import a skill by dragging a `SKILL.md` or `README.md` file into the skills screen
