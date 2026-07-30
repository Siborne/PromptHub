# Design

## `DES-TRAY-ACTION-001` Shared Command Contract

Add an `AppCommand` discriminated union in `packages/shared`. Current asset
kinds are `prompt | skill | mcp | plugin | rule`; future Agent management uses
its own command variant and is not added as a sixth asset kind.

## `DES-TRAY-ACTION-002` Native Menu Builder

Extract menu construction into a pure `tray-menu.ts` module. It receives
localized labels, current visibility, capability flags, and callbacks. The
main entry owns Electron object creation and refreshes the menu whenever window
visibility changes.

The label resolver contains complete dictionaries for `en`, `zh`, `zh-TW`,
`ja`, `fr`, `de`, and `es`. The stored `language` setting is validated before
use; invalid or unavailable values fall back to the normalized OS locale.
The renderer settings store remains the application-language source of truth,
but it must synchronize the normalized language to main-process settings both
when a user changes language and when legacy local storage is rehydrated. The
rehydration side effect runs only after the Zustand store has completed module
initialization so it cannot reference the store during its temporal dead zone.

## `DES-TRAY-ACTION-003` Renderer Command Bridge

The preload exposes a typed buffered subscription. A small renderer bridge maps
commands to navigation and existing DOM events. It stores workflow-opening
commands until React has rendered the requested home module. Lazy MCP and Plugin
workspaces announce listener readiness before the bridge dispatches their
creation events, preventing the first command from being lost during import or
mount.

Existing UI entry points remain authoritative:

- Prompt: `shortcut:newPrompt`
- Skill: `open-create-skill-modal`
- MCP: `open-create-mcp-modal`
- Plugin: `open-add-plugin-modal`
- Rule: module navigation only
- Quick Add: a typed `app:quick-add-prompt` custom event consumed by `TopBar`

## Analyze Gate

- Source of truth: main process tray state, shared command types, renderer UI
  state and existing creation modals.
- No database, asset, backup, sync, or public API semantics change.
- Stable docs identify native integration as main-process owned and renderer
  behavior as preload-mediated; this design agrees.
- Rules currently lacks a generic create workflow. The product-correct action
  is "manage", not a fabricated create surface.
- `FR-TRAY-ACTION-001..006 -> DES-TRAY-ACTION-001..003 ->
  TEST-TRAY-ACTION-001..006 -> T-TRAY-ACTION-001..007` has no blocking conflict
  or unresolved material decision.

## Verification Design

- `TEST-TRAY-ACTION-001`: black-box menu structure, copy, and callback command
  tests.
- `TEST-TRAY-ACTION-002`: every locale has a complete label dictionary and
  locale normalization covers regional/invalid values.
- `TEST-TRAY-ACTION-003`: stored-language reader covers valid, invalid,
  malformed, missing, and database-error branches.
- `TEST-TRAY-ACTION-004`: renderer bridge proves page/module routing, delayed
  modal delivery, settings, update, Rule, and cleanup behavior.
- `TEST-TRAY-ACTION-005`: TopBar proves both Quick Add modes reach the existing
  modal.
- `TEST-TRAY-ACTION-006`: typecheck, lint, build, and focused coverage.
- `TEST-TRAY-ACTION-007`: a production-build Electron test sends the same
  main-process command payloads used by the tray and verifies that the lazy MCP
  and Plugin creation workflows plus Prompt Quick Add are visibly opened.
- `TEST-TRAY-ACTION-008`: settings-store unit and production-build Electron
  tests prove a language stored only in renderer local storage is migrated to
  main-process settings, which the tray reads on `mouse-down` refresh.

Security, persistence rollback, fuzzed filesystem input, and performance stress
tests are omitted because the change accepts no external input and performs no
network, filesystem, or durable writes. Boundary tests still cover malformed
stored locale values and unavailable windows.
