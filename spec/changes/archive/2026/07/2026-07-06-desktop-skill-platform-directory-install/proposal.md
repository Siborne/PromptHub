# Proposal

## Why

PromptHub skill platform deployment currently treats a skill as a single `SKILL.md` file in parts of the stack. As a result, copy installs drop attachments and helper scripts, GitHub-installed skills only sync an allow-listed subset of files, symlink installs expose only one file instead of a usable skill directory, and the CLI/core platform install path still deploys only `SKILL.md`.

## Scope

- change desktop and core/CLI platform copy installs to deploy the full managed skill repo directory
- change desktop platform symlink installs to expose the full skill directory while still filtering PromptHub-internal sidecar directories
- preserve full remote GitHub skill directories, including binary attachments, when importing registry skills into the managed local repo
- add regression tests for directory copy, directory-level symlink behavior, and remote repo asset sync

## Risks

- platform installer changes affect desktop batch deployment flows, CLI `skill install-md`, and rename/redeploy behavior
- remote GitHub sync must keep SSRF protections and avoid corrupting binary files during download/write
- directory-level symlink exposure must still exclude `.git` and `.prompthub`

## Rollback

- revert platform deployment back to canonical `SKILL.md`-only installs and remove the binary remote sync path

## Impacted User Flows

- deploying an existing local skill with attachments to Claude Code / Gemini / Cursor / other skill platforms from desktop or CLI
- deploying a skill in copy mode and expecting sibling files next to `SKILL.md`
- deploying a skill in symlink mode and expecting updates to non-`SKILL.md` files to be reflected
- installing a GitHub-backed registry skill that includes images, templates, or binary assets
