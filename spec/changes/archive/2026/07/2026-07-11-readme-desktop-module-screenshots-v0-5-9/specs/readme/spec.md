# README Screenshot Delta

## FR-README-SHOT-001 Five-module coverage

The public Desktop screenshot section MUST visibly represent Prompt, Skill,
MCP, Plugin, and Rules workspaces in the current Desktop release.

### Scenario: Visitor evaluates Desktop modules

- Given a visitor opens any maintained repository README
- When the visitor reaches the screenshot section
- Then each of the five Desktop modules has an accurately captioned current
  screenshot.

## FR-README-SHOT-002 Current UI evidence

Screenshot assets MUST be captured from the Electron Desktop app using the
maintained deterministic fixture and use current visible labels and navigation.

### Scenario: Maintainer refreshes release docs

- Given Desktop navigation or module composition changes
- When screenshots are regenerated
- Then the capture workflow fails rather than retaining a blank or unreachable
  module surface.

## NFR-README-SHOT-001 Localized reference consistency

All maintained localized README screenshot sections MUST reference the same
current asset set, with localized captions and alt text.
