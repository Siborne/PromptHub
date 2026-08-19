# Spec Delta: Agent Rules Sources

## Added Requirements

### `FR-RULESRC-001`: Evidence-backed registry

Every supported Rules source MUST declare platform, scope, path template,
entry kind, extensions, recursive behavior, precedence, support state, and
evidence version. Documentation alone does not enable writes without a tested
adapter.

### `FR-RULESRC-002`: Claude directory support

Confirmed `.md` files below `~/.claude/rules/` and
`<project>/.claude/rules/` MUST be scanned with stable relative-path identity,
including nested directories within the declared limit.

### `FR-RULESRC-003`: Provenance and reconciliation

Each Rule MUST show platform, user/project scope, source path, format, and
current/missing/conflict state. Delete, move, or rename MUST reconcile without
deleting managed history or an external project root.

### `FR-RULESRC-004`: False-positive prevention

Ordinary directories such as `docs/rules` MUST NOT be scanned unless an
explicit platform adapter declares that exact location for the selected root.

### `NFR-RULESRC-001`: Bounded and safe traversal

Traversal MUST enforce root containment, depth, file count, per-file size,
aggregate bytes, symlink, extension, Unicode, and permission policies.

### `FR-RULESRC-005`: Verified Global Entry Files

When a platform documents a stable user-level rule file, or a stable user-level
rules directory that explicitly accepts a conventional entry file, PromptHub
MUST expose that exact entry through the existing Agent Rules workflow. The
first supported additions are:

- Kiro: `<KIRO_HOME>/steering/AGENTS.md`;
- Augment: `~/.augment/user-guidelines.md`;
- Cline CLI: `~/.cline/data/settings/rules/AGENTS.md`.

Opening the Agent MUST derive the path and filename from the shared platform
registry. A missing entry MUST use the explicit creation gate. Supporting one
entry file MUST NOT claim complete management of sibling rule files or
project-only sources. Cursor, Qoder, Cherry Studio, TRAE, and other platforms
without a verified user-level filesystem entry MUST remain unavailable rather
than receive an invented global file.

## Verification

- `TEST-RULESRC-001`: table-driven official/fixture matrix by platform, scope,
  path, extension, recursion, and precedence.
- `TEST-RULESRC-002`: Windows/macOS/Linux Claude user/project directories,
  nested files, reload, edit, version, and missing reconciliation.
- `TEST-RULESRC-003`: `docs/rules`, traversal, null byte, symlink escape,
  oversized inventory, duplicate content, and permission denial.
- `TEST-RULESRC-004`: large bounded tree proves linear traversal, finite reads,
  incremental fingerprint reuse, and no N+1 database writes.
- `TEST-RULESRC-005`: table-driven platform, descriptor, resolved-path,
  capability, missing-file creation, and existing-empty-file coverage for Kiro,
  Augment, and Cline; negative assertions for project-only or unverified
  platforms.
