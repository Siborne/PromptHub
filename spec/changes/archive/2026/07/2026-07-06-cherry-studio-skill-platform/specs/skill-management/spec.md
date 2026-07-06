# Skill Management Spec Delta

## Added Requirements

### Requirement: Cherry Studio Built-In Agent

PromptHub MUST expose Cherry Studio as a built-in skill platform so users can manage Cherry Studio skills without manually creating a custom agent.

#### Scenario: Windows default path

- Given the current platform is Windows
- And the user's home directory is `C:\Users\TestUser`
- When PromptHub resolves Cherry Studio's built-in skill directory
- Then the root directory is `%APPDATA%\CherryStudio`
- And the skill directory is `%APPDATA%\CherryStudio\Data\Skills`

#### Scenario: Unified skill lifecycle

- Given Cherry Studio is a built-in skill platform
- When PromptHub lists platforms, installs skills, scans skills, or removes distributed skills
- Then Cherry Studio appears through the same platform list as other built-in platforms
- And Cherry Studio install, uninstall, and status checks use a Cherry Studio-specific adapter.

### Requirement: Cherry Studio Registry-backed Install

PromptHub MUST register Cherry Studio skills in Cherry Studio's SQLite database. Copying a folder to `Data/Skills` alone MUST NOT be treated as a successful install.

#### Scenario: Folder exists without registry row

- Given `Data/Skills/writer/SKILL.md` exists
- And `agent_global_skill` has no row whose `folder_name` is `writer`
- When PromptHub checks Cherry Studio install status for `writer`
- Then the status is not installed.

#### Scenario: Install copies package and registers metadata

- Given a PromptHub skill package contains `SKILL.md` and additional nested files
- And the Cherry Studio database contains the `agent_global_skill` table
- When PromptHub installs the skill into Cherry Studio
- Then PromptHub copies the whole skill folder into `Data/Skills/<folder>`
- And PromptHub upserts `agent_global_skill` metadata derived from `SKILL.md`
- And the content hash is computed from `SKILL.md`.

#### Scenario: Uninstall removes enabled agent symlinks

- Given a Cherry Studio skill is registered in `agent_global_skill`
- And at least one enabled `agent_skill` row points at it
- And the agent workspace contains `.claude/skills/<folder>` as a symlink
- When PromptHub uninstalls the skill from Cherry Studio
- Then PromptHub removes the symlink
- And deletes the `agent_skill` rows
- And deletes the `agent_global_skill` row
- And removes `Data/Skills/<folder>`.
