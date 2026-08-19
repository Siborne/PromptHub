# Project Skill Management Delta

## Requirements

- PromptHub must support registering local project directories as project-level Skill sources.
- PromptHub must allow each registered project to define one or more scan roots for discovering `SKILL.md` files.
- PromptHub must allow users to inspect project-level Skills without forcing them into the global Skill library.
- PromptHub must allow users to explicitly import a project-level Skill into the PromptHub Skill library.
- PromptHub should support project-scoped skill distribution targets so a project-level Skill can be deployed into that project's local tool directories without first becoming a global-only deployment.
- PromptHub must keep project-level Skills distinct from library-managed Skills in the UI.

## Scenarios

- User adds a project root and sees it under a dedicated `Projects` entry in the Skill sidebar.
- User scans a project and sees discovered Skills grouped under that project.
- User opens a project Skill and manages it directly without distributing it.
- User imports a project Skill into the global Skill library, after which it follows the existing library/distribution lifecycle.
- User selects a project-local deployment target, and PromptHub writes the Skill into the current project's supported tool folder such as `.claude`, `.gemini`, or `.agents` instead of only offering global distribution.
- Project-local distribution should default to the current project's `.agents/skills` directory, while allowing the user to add and multi-select additional target folders.
- When PromptHub deploys a project-local Skill into a project folder, it must copy the whole Skill directory as `<target>/<skill-name>/...` so the destination remains scan-compatible and preserves supporting files beyond `SKILL.md`.
