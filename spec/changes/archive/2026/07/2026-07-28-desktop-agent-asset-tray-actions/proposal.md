# Proposal: Desktop Agent Asset Tray Actions

## Status

Implemented and verified locally; awaiting publication.

## Why

The macOS menu bar item currently exposes only "Show Window" and "Quit".
PromptHub already manages Prompt, Skill, MCP, Plugin, and Rule assets, so the
menu should provide short, native entry points into those existing workflows
without duplicating renderer business logic.

## Scope

- Add localized tray actions for creating or managing the five current Agent
  asset kinds.
- Add quick Prompt creation actions, update checking, settings, and a dynamic
  show/hide action.
- Route tray intent through a typed main/preload/renderer contract.
- Reserve a separate, capability-hidden command boundary for future first-class
  Agent management.
- Keep existing creation modals and module stores as the workflow source of
  truth.

## Non-Goals

- Do not implement first-class Agent entities or show disabled Agent menu
  placeholders.
- Do not invent a generic Rule creation modal. The tray opens the existing Rule
  management workspace.
- Do not change asset persistence, schemas, backup, sync, or installation
  behavior.
- Do not redesign the application menu in this change.

## Ownership And Risk

- Main process owns the native tray lifecycle and localization lookup.
- `packages/shared` owns the cross-process command contract.
- Renderer owns navigation and opening existing workflows.
- The primary regression risk is a command being delivered before its target
  module is mounted. The renderer bridge therefore waits for the requested page
  and module before dispatching the existing UI event.

## Impacted User Flows

1. Menu bar -> create Prompt / Skill / MCP / Plugin.
2. Menu bar -> manage Rule assets.
3. Menu bar -> quick-add Prompt in analyze or generate mode.
4. Menu bar -> show/hide app, settings, update dialog, or quit.

## Rollback

Remove the typed command listener and restore the two-item menu. No persisted
data or migration is involved.
