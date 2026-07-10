# CLI Feature Completeness

## Purpose

Close the gap between the standalone PromptHub CLI and the desktop product for automation, scripting, and portable workspace migration.

## Why

CLI already covers prompts, folders, rules, skills, MCP distribution, AI config, and basic workspace/sync. Review found blocking gaps:

- workspace/sync snapshots omit skill package files, prompt relations, and output-format sequences
- force-clear leaves orphan relation/output-format rows
- no Plugin command surface
- MCP lacks create/update/delete
- prompt parent tree, relations, and output formats are not CLI-manageable
- skill metadata update and source update checks are missing
- public README CLI docs lag behind implemented commands

## Scope

- Extend CLI workspace/sync snapshots and restore/clear semantics
- Add MCP create/update/delete
- Add Plugin CLI resource
- Add prompt parent-id, relation, and output-format commands
- Add skill update and check-update
- Align help text and repository-facing CLI docs

## Non-goals

- WebDAV CLI
- GUI-only AI chat / multi-model test / reverse-prompt flows
- Desktop one-click CLI install PATH detection (tracked separately)

## Risks

- Larger CLI surface increases maintenance cost
- Snapshot growth from skillFiles may produce large export files
- Web sync schema may strip unknown fields until server schema is extended

## Rollback

Remove new command branches and snapshot fields; existing v2 bundles remain readable.
