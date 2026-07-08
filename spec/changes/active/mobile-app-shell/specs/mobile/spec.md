# Mobile App Shell Delta Spec

## Added Requirements

### MOBILE-FR-001: Mobile Workspace Entry

PromptHub shall provide a mobile workspace app under `apps/mobile` that can be developed independently from the desktop Electron renderer.

#### Scenario: Developer starts the mobile shell

Given the monorepo has dependencies installed
When a developer runs the mobile dev script
Then Expo shall load the mobile app entry without requiring desktop IPC or Electron APIs.

### MOBILE-FR-002: Prompt And Skill First Scope

The first mobile shell shall prioritize Prompt and Skill management surfaces before MCP management.

#### Scenario: User opens the first mobile app shell

Given the user starts the mobile app
When the app loads
Then they shall see tab entry points for Prompts, Skills, Store, and Settings.

### MOBILE-FR-003: Skill Package Boundary

Mobile Skill code shall preserve the existing Skill package model where `SKILL.md` is the package entry file and not the full package boundary.

#### Scenario: Future import work attaches persistence

Given a mobile Skill summary is loaded
When later import or storage code persists it
Then it must be able to track both the package directory and the `SKILL.md` entry path.

## Non-Requirements

- The initial shell does not implement durable SQLite storage.
- The initial shell does not implement sync or conflict resolution.
- The initial shell does not install Skills into desktop AI tools.
- The initial shell does not manage MCP servers.

## Verification

- MOBILE-TEST-001: TypeScript must compile for `apps/mobile`.
- MOBILE-TEST-002: Mobile navigation metadata must expose the expected four tabs with stable route names.
