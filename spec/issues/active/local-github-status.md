# Local GitHub Issue Status

## Purpose

This file is the local triage and delivery overlay for GitHub issues.

The GitHub snapshots record remote facts:

- `github-open.md`: issues currently open on GitHub.
- `../archive/github-closed.md`: issues currently closed on GitHub.

This file records PromptHub's local delivery state. A GitHub issue can remain
open while its local status is `local_done` or `release_pending`; GitHub issues
are closed only after the version containing the change has been published.

## Status Values

| Status            | Meaning                                                                       | GitHub action                        |
| ----------------- | ----------------------------------------------------------------------------- | ------------------------------------ |
| `untriaged`       | The issue exists remotely but has not been classified locally.                | Leave open                           |
| `accepted`        | The issue is valid and should be handled, but implementation has not started. | Leave open                           |
| `in_progress`     | A local change is actively handling the issue.                                | Leave open                           |
| `local_done`      | Code, tests, and docs are complete locally, but not released.                 | Leave open                           |
| `release_pending` | The issue is assigned to a release that has not shipped yet.                  | Leave open                           |
| `released`        | The target version has shipped.                                               | Close GitHub, then refresh snapshots |
| `wontfix`         | The project will not implement this issue.                                    | Explain publicly, then close         |
| `duplicate`       | The issue is tracked by another issue.                                        | Link the canonical issue, then close |

## Current Local Overlay

| Issue | GitHub state | Local status    | Target release | Change                                                             | Notes                                                                                                                                                                                                              |
| ----- | ------------ | --------------- | -------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| #183  | open         | local_done      | next patch     | `skill-frontmatter-yaml-parser`                                    | Shared YAML parsing now covers Desktop, CLI, Web, marketplaces, and Skill detail surfaces; lossless rewrites, embedded indentation, and strict unsafe/malformed YAML rejection are verified.                         |
| #184  | closed       | released        | 0.5.9          | `cli-desktop-database-concurrency`, `desktop-legacy-lock-recovery` | Shared SQLite coordination, typed contention handling, Desktop refresh, and ownerless legacy-lock recovery shipped in `0.5.9`.                                                                                    |
| #181  | closed       | released        | 0.5.9          | `cli-install-manual-fallback`                                      | Windows `where.exe`, custom npm prefix, and manual CLI path fallbacks shipped in `0.5.9`.                                                                                                                           |
| #180  | closed       | released        | 0.5.9          | `export-backup-sync-consistency`                                   | Custom Skill/MCP/Plugin store source backup and restore shipped in `0.5.9`.                                                                                                                                         |
| #179  | closed       | released        | 0.5.9          | `desktop-issue-179-configured-skill-targets`                       | Configured custom and overridden Agent distribution targets shipped in `0.5.9`.                                                                                                                                    |
| #178  | closed       | released        | 0.5.9          | `desktop-issue-178-hermes-localappdata`                            | `%LOCALAPPDATA%` and Hermes Windows Native path handling shipped in `0.5.9`.                                                                                                                                        |
| #170  | closed       | released        | 0.5.9          | `skill-package-boundary`                                           | Complete GitHub Skill package installation, including non-`SKILL.md` assets, shipped in `0.5.9`.                                                                                                                   |
| #169  | closed       | released        | 0.5.9          | `web-prompt-clipboard-copy`                                        | Web Markdown Prompt clipboard fallback shipped in `0.5.9`.                                                                                                                                                         |
| #168  | closed       | released        | 0.5.9          | `my-skill-source-update`                                           | Skill source fingerprint reconciliation and false local-modification fixes shipped in `0.5.9`.                                                                                                                    |
| #177  | open         | accepted        |                |                                                                    | SkillHub integration is a valid store-adapter request, but multiple unrelated SkillHub services exist; confirm the exact URL and API/source contract first.                                                        |
| #176  | closed       | released        | 0.5.9          | `plugin-management`                                                | Markerless multi-capability Claude bundle detection shipped in `0.5.9` while single-capability false positives remain excluded.                                                                                    |
| #175  | closed       | released        | 0.5.9-beta.2   | `mcp-management`                                                   | Closed as completed after confirming the published beta includes the requested AGHub-style My/Agent/Store Skill and MCP workbenches.                                                                               |
| #167  | closed       | released        | 0.5.9          | `unified-custom-store-sources`                                     | Store-local search for custom marketplace JSON, Git repository, and local-directory Skill Store sources shipped in `0.5.9`.                                                                                        |
| #160  | closed       | released        | 0.5.9          | `issue-160-prompt-detail-usability`                                | Prompt detail editing and folder-count usability improvements shipped in `0.5.9`.                                                                                                                                  |
| #159  | closed       | released        | 0.5.9          | `web-auth-captcha`                                                 | Desktop-to-Web URL normalization, captcha configuration, and 401 compatibility handling shipped in `0.5.9`.                                                                                                       |

## Update Rules

- Update this file whenever a GitHub issue is triaged, attached to an active change, completed locally, assigned to a release, or publicly closed.
- Do not edit `github-open.md` or `github-closed.md` for local delivery status; those files are regenerated from GitHub.
- Before a release, scan for `local_done` issues and move included items to `release_pending`.
- After a release, move shipped items to `released`, close the corresponding GitHub issues with the release version, then refresh both GitHub snapshots.
