# Delta Spec

## Added

- Skill-domain fixes MUST include a regression test that reproduces the user-visible failure, not just the suspected internal function call.
- Skill install/delete/distribute tests MUST assert durable state across the relevant surfaces:
  - SQLite skill metadata
  - managed local repo files
  - platform copied/symlinked files
  - activation/status records
  - list view, detail view, and project view derived status
- Custom store tests MUST include at least one full-directory repo fixture with nested files and directories, not only a single `SKILL.md`.
- Project distribution tests MUST cover both install and uninstall for copy and symlink modes.
- Safety scan tests MUST cover custom Git/Gitea source policy and managed local repo paths.
- Store count tests MUST verify tab count, header count, and rendered card count are derived from the same filtered source.
- Skill file browser tests MUST cover recursive folder expansion.

## Modified

- A skill test that only asserts a mocked function was called is insufficient unless it also checks the observable post-condition the user relies on.

## Removed

- None.

## Scenarios

- Scenario: Custom store full-directory install
  - Given a custom Git/Gitea store skill with `SKILL.md`, nested docs, scripts, and assets
  - When the user imports it
  - Then the managed repo contains all non-ignored files
  - And the detail file browser can open nested folders/files

- Scenario: Platform symlink lifecycle
  - Given a skill installed to a platform by symlink
  - When the user deletes or uninstalls the skill
  - Then the platform symlink and activation status are removed
  - And list/detail/project views no longer show it as installed

- Scenario: Project skills view consistency
  - Given a skill is distributed to a project by copy or symlink
  - When project skills are scanned
  - Then the project skills tab shows the skill
  - And the user can tag and uninstall it from the project context
