# Skills Spec Delta

## Modified Requirements

### Platform skill deployment preserves the skill directory

Desktop platform deployment MUST install the full managed skill directory for a skill, not only the canonical `SKILL.md` file.

#### Scenario: copy install preserves attachments

- Given a managed skill repo contains `SKILL.md`, nested helper scripts, and attachments
- When the user deploys the skill to a detected platform in copy mode
- Then the platform skill directory contains the same allowed files and subdirectories
- And PromptHub-internal directories such as `.git` and `.prompthub` are excluded

#### Scenario: soft install uses a directory symlink

- Given a managed skill repo contains `SKILL.md` and additional allowed files
- When the user deploys the skill to a detected platform in symlink mode
- Then the platform skill directory itself is a directory symlink to the managed skill repo
- And changes to files already present in that managed repo are reflected through the platform directory symlink

#### Scenario: symlink install falls back to copy with explicit feedback

- Given the user deploys a skill in symlink mode
- And the target platform cannot create directory symlinks because of filesystem permissions or platform limitations
- When PromptHub falls back to a copy install to keep the deployment usable
- Then the install still completes successfully with the copied skill directory
- And the desktop renderer receives structured fallback metadata instead of treating the install as a plain symlink success
- And the UI shows a warning that copy mode was used for the affected platforms, including the fallback reason

### GitHub-backed registry installs preserve repository assets

GitHub-backed registry installs MUST sync the full skill directory into the managed local repo without corrupting binary attachments.

#### Scenario: registry install syncs binary assets

- Given a GitHub-backed registry skill directory includes `SKILL.md` and binary assets such as images
- When the user installs the skill from the registry
- Then PromptHub stores `SKILL.md` and sibling assets in the managed local repo
- And binary files are written byte-for-byte rather than as UTF-8 text

### GitHub repository installs resolve a single skill directory

When installing from a GitHub repository URL, PromptHub MUST treat the skill unit as the directory that contains `SKILL.md`, not the whole repository root by default.

#### Scenario: repository root contains one nested skill directory

- Given a GitHub repository root does not contain `SKILL.md`
- And exactly one nested directory contains `SKILL.md`
- When the user installs that GitHub repository URL as a skill
- Then PromptHub stores that nested `SKILL.md` directory as the skill repo path

#### Scenario: repository contains multiple skill directories

- Given a GitHub repository contains more than one directory with `SKILL.md`
- When the user installs that GitHub repository URL as a single skill
- Then PromptHub rejects the install and instructs the user to install a specific skill directory instead of the repo root
