# Proposal

## Problem

PromptHub can distribute Skills into Agent/platform directories, but users cannot browse or manage the Skills from the Agent's point of view. The current UI answers "where is this Skill installed?" from My Skills, but not "what Skills does this Agent currently have?".

This gap hides copied and symlinked installations after distribution, makes uninstall hard to discover, and prevents users from auditing custom Agent directories as first-class Skill containers.

## Scope

- Add an Agent Skills entry inside the desktop Skills module.
- Show Agent/platform entries in a middle list using the same structural pattern as Project Skills.
- For a selected Agent, scan the Agent's actual Skills directory and show all discovered Skills.
- Label each Agent Skill as symlink or copy.
- Allow uninstalling a scanned Agent Skill from that Agent directory.
- Allow importing selected My Skills into the selected Agent with copy or symlink mode.

## Non-Goals

- Do not replace the existing My Skills distribution badges.
- Do not create a new persistent database table for Agent scan results unless runtime state proves insufficient.
- Do not scan arbitrary non-Agent directories from this view; custom Agent directories come from existing settings.

## Risks

- Agent directories may contain Skills not managed by PromptHub. The UI must treat scanned filesystem state as authoritative and allow remove-by-agent-target without requiring a DB Skill row.
- Symlink and copy modes must be detected from the filesystem, not inferred from stored UI state.
- Existing Project Skills UI is large; reuse visual patterns without entangling project-specific preferences.
