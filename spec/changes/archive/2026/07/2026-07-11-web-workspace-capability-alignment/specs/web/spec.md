# Web Workspace Capability Alignment Delta

## FR-WEB-CORE-001 Durable advanced Prompt workflows

The self-hosted Web app MUST let an authorized user move a prompt in the
hierarchy and manage prompt relations and output-format sequences through
server-backed APIs.

### Scenario: Browser reorders a prompt

- Given a user can edit a prompt
- When the browser moves it to a valid parent and sort position
- Then the server persists the hierarchy change and updates the workspace
- And another client reads the same new hierarchy.

### Scenario: Browser manages relation and output-format data

- Given a user can access both referenced prompts
- When the user creates, lists, updates, deletes, or reorders a relation or
  output-format item
- Then the server persists the existing shared data contract.

## FR-WEB-CORE-002 Honest browser capability boundary

The Web workspace MUST not expose MCP, Plugin, local Agent, local Skill
package, platform-installation, or native-shell workflows that require a
Desktop filesystem or Electron capability.

### Scenario: Browser opens the workspace

- Given a self-hosted Web session
- When the shared renderer initializes
- Then it exposes only Prompt, browser-safe Skill, and Rules modules
- And capability checks disable local Skill filesystem and platform operations.

## FR-WEB-CORE-003 Agent asset continuity

The Web app MUST preserve MCP and Plugin libraries, packages, store sources,
and agent asset files in sync and backup payloads even though those resources
are not directly managed from the browser.

## NFR-WEB-CORE-001 Contract safety

New Prompt endpoints MUST validate identifiers, ownership/visibility, parent
hierarchy, output-format references, and ordering inputs before mutating data.

## Acceptance Criteria

- `AC-WEB-CORE-001`: browser bridge calls persist relation, output-format, and
  hierarchy operations through authenticated Web APIs.
- `AC-WEB-CORE-002`: browser navigation cannot reach MCP or Plugin managers,
  and unavailable local Skill actions are not advertised.
- `AC-WEB-CORE-003`: a sync import/export retains opaque MCP and Plugin assets.
