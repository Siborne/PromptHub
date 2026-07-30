# Desktop UI Delta: Agent Asset Tray Actions

## Added Requirements

### `FR-TRAY-ACTION-001` Agent Asset Entry Points

The desktop tray menu must expose usable entry points for Prompt, Skill, MCP,
Plugin, and Rule assets. Prompt, Skill, MCP, and Plugin entries open their
existing creation workflows; Rule opens the existing management workspace.

### `FR-TRAY-ACTION-002` Quick Prompt Entry Points

The tray menu must open Quick Add directly in either analyze-existing-content
or AI-generate mode.

### `FR-TRAY-ACTION-003` Native App Actions

The tray menu must expose dynamic show/hide, update checking, settings, and
quit actions. Show/hide copy must reflect current window visibility.

### `FR-TRAY-ACTION-004` Typed Cross-Process Routing

Tray actions must cross main, preload, and renderer boundaries through a
shared discriminated union. Renderer actions must not be implemented as main
process business logic.

### `FR-TRAY-ACTION-005` Future Agent Management Boundary

First-class Agent management must remain separate from Agent asset kinds. Its
command may be reserved in the contract and menu builder, but the production
menu must hide it until the capability is implemented.

### `FR-TRAY-ACTION-006` Localization

Every tray label must be available for the seven supported desktop locales.
The current stored application language is authoritative, with the OS locale as
a fallback before the settings database is ready.

## Acceptance Scenarios

- Selecting an asset command reveals and focuses PromptHub, navigates home,
  selects the target module, and opens the existing workflow when one exists.
- Selecting Rule management navigates to Rules without claiming a nonexistent
  creation workflow.
- Selecting a quick-add mode opens Quick Add with the chosen mode.
- Selecting settings or update opens the existing corresponding surface.
- Agent management is absent while its capability flag is false.
- All label dictionaries have the same complete key set.
