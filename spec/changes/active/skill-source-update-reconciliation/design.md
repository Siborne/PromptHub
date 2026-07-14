# Design

## Overview

Skill source update reconciliation must become a shared domain workflow, not a UI-only helper.

The core model is:

```text
source identity -> resolve B/L/R -> classify state -> choose allowed action -> apply atomically -> refresh baselines
```

Where:

- `B` is the last known successful source baseline stored in DB.
- `L` is the current local My Skills package after syncing from the active package path.
- `R` is the current source package resolved from registry, remote Git, package URL, content URL, or explicit local source.

## `DES-SU-001` Source Identity Model

Source identity must be explicit and stable. Display names and slugs are not enough.

### Canonical Source Key

Use this normalized tuple to derive source identity when `source_id` is absent:

```text
source_type | source_url | source_branch | source_directory | canonical_skill_path
```

Normalization:

- trim whitespace
- convert path separators to `/`
- strip trailing `/`
- lowercase host and source type
- preserve case inside local paths only where the filesystem is case-sensitive
- normalize empty values to `""`

### Source Kinds

| Kind             | Example                                         | Update Behavior                                                                              |
| ---------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `remote-store`   | official/custom marketplace entry               | Resolve registry entry, then package/content source                                          |
| `remote-git`     | GitHub/Gitea/SSH repo with branch and directory | Clone or inspect tree, compute package fingerprint                                           |
| `remote-zip`     | release package URL                             | Download zip to temp, validate package                                                       |
| `content-url`    | raw `SKILL.md` URL only                         | Treat as a single-file package; package fingerprint equals the normalized entry content hash |
| `local-linked`   | external local folder import                    | Local folder is My Skills source; remote update only if explicit remote metadata also exists |
| `managed-copy`   | PromptHub managed repo                          | Local managed repo is current package; source metadata decides whether remote exists         |
| `project-scan`   | project `.agents/skills` snapshot               | Scan-only until imported                                                                     |
| `agent-scan`     | platform directory snapshot                     | Scan-only until imported                                                                     |
| `backup-restore` | restored source metadata                        | Use restored metadata; no name collapse                                                      |

## `DES-SU-002` Source Origin Versus Install Mode

The update workflow applies to My Skills source packages only.

Project and agent install rows remain scan snapshots:

- symlink target may reflect My Skills changes automatically
- copied target does not update automatically
- external target is not owned by PromptHub
- built-in platform Skill is protected by platform metadata

After My Skills updates, project/agent copy targets can become stale. That status belongs to distribution scan, and is tracked separately from My Skills source update status.

## `DES-SU-003` Reconciliation Algorithm

### Inputs

```ts
interface SkillSourceSnapshot {
  contentHash?: string;
  directoryFingerprint?: string;
  version?: string;
  // Legacy is accepted only while upgrading existing rows; new durable snapshots use skill-package-sha256-v1.
  fingerprintAlgorithm: "skill-package-sha256-v1" | "legacy-stable-text-v1";
  resolvedAt: number;
}

interface SkillSourceReconciliationInput {
  skillId: string;
  sourceIdentity: string | null;
  baseline: SkillSourceSnapshot | null;
  local: SkillSourceSnapshot | null;
  remote: SkillSourceSnapshot | null;
}
```

### Comparison Rules

Use full package fingerprint when available:

```text
samePackage(A, B):
  if A.directoryFingerprint and B.directoryFingerprint:
    return A.directoryFingerprint == B.directoryFingerprint
  return A.contentHash == B.contentHash
```

Then:

```text
localModified = baseline exists and local exists and !samePackage(local, baseline)
remoteChanged = baseline exists and remote exists and !samePackage(remote, baseline)
```

### State Classification

| Baseline | Local     | Remote    | Status                                                                         |
| -------- | --------- | --------- | ------------------------------------------------------------------------------ |
| none     | any       | none      | `no-source` or `source-unavailable` depending source metadata                  |
| none     | L         | R         | `up-to-date` and initialize baseline if `L == R`; otherwise `baseline-missing` |
| B        | L missing | any       | `source-unavailable` for local path failure, with local error                  |
| B        | L         | R missing | `source-unavailable`                                                           |
| B        | `L == B`  | `R == B`  | `up-to-date`                                                                   |
| B        | `L == B`  | `R != B`  | `update-available`                                                             |
| B        | `L != B`  | `R == B`  | `local-modified`                                                               |
| B        | `L != B`  | `R != B`  | `conflict`                                                                     |

In v1, `source-moved` automatic lineage matching is deferred. If the resolved canonical source identity differs from the stored source identity, the check will return `baseline-missing` or require manual rebinding, preventing automated incorrect updates.

## `DES-SU-004` Package Baseline Data Model

Existing fields:

- `source_url`
- `source_id`
- `source_label`
- `source_branch`
- `source_directory`
- `canonical_skill_path`
- `local_repo_path`
- `directory_fingerprint`
- `content_url`
- `installed_content_hash`
- `installed_version`
- `installed_at`
- `updated_from_store_at`

Required additions:

| Column                            | Type      | Purpose                                                                      |
| --------------------------------- | --------- | ---------------------------------------------------------------------------- |
| `installed_directory_fingerprint` | `TEXT`    | Last successful source package baseline                                      |
| `fingerprint_algorithm`           | `TEXT`    | Single algorithm/version for both current and installed package fingerprints |
| `source_last_checked_at`          | `INTEGER` | Last completed source check                                                  |
| `source_last_error`               | `TEXT`    | Last source check error summary, sanitized                                   |
| `source_binding_state`            | `TEXT`    | `bound`, `detached`, `missing-baseline`, or null                             |

`fingerprint_algorithm` is intentionally a single field. The current package fingerprint and installed baseline must be recomputed together when upgrading from legacy data; v1 must not store mixed algorithms for `directory_fingerprint` and `installed_directory_fingerprint`.

Optional future column:

| Column                 | Type   | Purpose                                                   |
| ---------------------- | ------ | --------------------------------------------------------- |
| `source_snapshot_json` | `TEXT` | Auditable structured snapshot for remote package metadata |

The first implementation should prefer explicit columns for query and migration clarity. `source_snapshot_json` is useful later for detailed diagnostics, but should not be the only durable source of truth.

## `DES-SU-005` Hash And Fingerprint Algorithm

### Naming

Use “fingerprint” in code and UI. Do not label durable hashes as MD5 unless the algorithm is actually MD5.

v1 algorithm:

```text
skill-package-sha256-v1
```

### Content Hash

For `SKILL.md` content hash:

1. Normalize line endings to `\n`.
2. Preserve body content.
3. Normalize frontmatter ordering only if existing behavior depends on it.
4. Trim trailing whitespace at end of file.
5. Compute SHA-256 over UTF-8 bytes.

### Package Fingerprint

For full package fingerprint:

1. Walk all files under package root.
2. Do not follow symlinks.
3. Represent a symlink as `symlink:<relativePath>:<linkTarget>` if symlink entries are allowed; otherwise exclude symlink entries and surface a safety finding.
4. Normalize relative paths to POSIX `/`.
5. Exclude entries through the shared ignore predicate.
6. For each included file:
   - text files: normalize line endings and trailing whitespace, then SHA-256
   - binary files: SHA-256 raw bytes
7. Sort entries by normalized path.
8. Build manifest lines:

```text
file:<relativePath>:<contentSha256>
symlink:<relativePath>:<target>
```

9. SHA-256 the manifest text.

For raw `content-url` sources, skip directory walking and wrap the normalized `SKILL.md` content hash as the package fingerprint. This keeps reconciliation generic while acknowledging that the package contains exactly one file.

### Legacy Fingerprints

Current `computeStableTextHash` returns a 64-character fallback hash but is not SHA-256. Treat those values as `legacy-stable-text-v1`.

Legacy migration strategy:

- If `installed_directory_fingerprint` is empty and `installed_content_hash` or the old local `SKILL.md` hash matches the resolved remote `SKILL.md` hash, background-initialize `installed_directory_fingerprint` and `directory_fingerprint` with `skill-package-sha256-v1`, update the single `fingerprint_algorithm` column to `skill-package-sha256-v1`, and keep the user flow silent.
- If the legacy entry hash does not match the resolved remote entry hash, return `baseline-missing` instead of silently choosing one side, and offer the user resolution choices to keep local as baseline, reset from source, or detach.

## `DES-SU-006` Ignore Rules

The existing `shouldIgnoreSkillDirectoryEntry()` behavior is the design baseline and should become the single shared predicate for desktop main, renderer, CLI, and tests.

### Must Ignore

- VCS: `.git/`
- PromptHub internals: `.prompthub/`
- dependencies: `node_modules/`
- Python caches: `__pycache__/`, `.pytest_cache/`, `.mypy_cache/`, `.ruff_cache/`
- JS/build caches: `.vitest/`, `.vite/`, `.parcel-cache/`, `.turbo/`, `.next/`, `.nuxt/`, `.svelte-kit/`
- coverage/cache/temp: `coverage/`, `.nyc_output/`, `.cache/`, `.tox/`, `.nox/`, `.tmp/`, `tmp/`, `temp/`
- virtual envs: `.venv/`, `venv/`
- package manager cache: `.npm/`, `.pnpm-store/`, `.yarn/cache/`
- generated files: `*.pyc`, `*.pyo`, `*.log`, `*.tmp`, `*.temp`, `*.pid`, `*.sock`, `*.swp`, `*.swo`, `*.tsbuildinfo`, `Thumbs.db`, `desktop.ini`
- local env secrets: `.env`, `.env.*` except templates

### Must Include

- `.env.example`
- `.env.sample`
- `.env.template`
- hidden distributable files not explicitly ignored
- all package scripts/assets/docs/examples/reference files

### Negative Rule

Do not ignore every dotfile. Some dotfiles are distributable package behavior.

## `DES-SU-007` Status And UI Contract

The source update result should include enough detail for UI and tests:

```ts
type SkillSourceUpdateStatus =
  | "no-source"
  | "source-unavailable"
  | "baseline-missing"
  | "up-to-date"
  | "update-available"
  | "local-modified"
  | "conflict";

interface SkillSourceUpdateCheck {
  status: SkillSourceUpdateStatus;
  skillId: string;
  sourceIdentity?: string;
  local?: SkillSourceSnapshot;
  baseline?: SkillSourceSnapshot;
  remote?: SkillSourceSnapshot;
  localModified: boolean;
  remoteChanged: boolean;
  hasStaleTargets: boolean; // Auxiliary distribution signal; never changes source status.
  staleTargets?: Array<{
    targetType: "project" | "agent";
    targetId: string;
    installMode: "copy" | "symlink" | "external";
    currentFingerprint?: string;
    expectedFingerprint?: string;
  }>;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}
```

UI behavior:

- `no-source`: hide update button or show disabled “Local only”.
- `up-to-date`: show success state; no primary action.
- `update-available`: show primary “Update from source”.
- `local-modified`: show warning; primary action is not overwrite. Offer “Reset from source” behind confirmation.
- `conflict`: show danger/warning; require compare or explicit overwrite.
- `baseline-missing`: show setup decision dialog titled “无法确定修改历史 (Unable to reconcile history)”; description: “由于此技能是从旧版本升级而来，我们无法确认您是否对本地文件进行了修改。为了避免覆盖您可能做出的调整，请选择后续操作：”; actions: “保留本地修改并建立基准”, “重置为来源版本（覆盖本地）”, “解除与来源的绑定”.
- `source-unavailable`: show retry and source settings.

## `DES-SU-008` Linked Local Source Design

A linked local source has two possible layers:

```text
external local folder (required content source)
optional remote source metadata (only if user imported from or bound to a remote source)
```

Rules:

- The external folder is read directly for `L`.
- PromptHub never writes a managed copy unless the user converts import mode.
- If no remote metadata exists, source update check returns `no-source` after local sync.
- If remote metadata exists, remote check compares external local `L` against baseline `B` and remote `R`.
- **v1 Constraint**: To protect external files, PromptHub blocks direct remote update overwrites to external linked folders. The UI must prompt the user to convert to a PromptHub managed copy before applying the remote update, or instruct the user to manually pull/update the external folder in their editor or VCS tool. v1 must not write remote contents into the external path.

## `DES-SU-009` Safe Apply And Rollback

Source update apply sequence:

1. Resolve current skill and active package path.
2. Sync from local repo to DB to get accurate `L`.
3. Run reconciliation.
4. If status is not `update-available`, stop unless explicit force option matches status.
5. Create version snapshot containing current `SKILL.md` and file snapshot.
6. Resolve remote package into temp staging directory.
7. Validate staging:
   - one valid root `SKILL.md`
   - source identity matches expected source
   - path traversal blocked
   - package fingerprint computed
8. Run security/safety scans on the staged temp directory before writing into the final package path. If any high-severity vulnerability, malicious code pattern, or unauthorized command is detected, remove staging, leave the current package untouched, keep DB baseline unchanged, and return a blocking error.
9. Replace managed repo atomically:
   - write to temp under same parent when possible
   - rename old repo to backup path
   - rename staged repo to final path
   - remove backup after DB commit succeeds
10. Update DB:

- content/instructions from staged `SKILL.md`
- metadata from frontmatter/source
- `directory_fingerprint`
- `installed_content_hash`
- `installed_directory_fingerprint`
- `fingerprint_algorithm`
- `installed_version`
- `updated_from_store_at`
- clear `source_last_error`

11. On failure:

- restore old repo path if it was moved
- leave DB baseline unchanged
- record sanitized `source_last_error`

## `DES-SU-010` Resolution Actions

| Status               | Allowed Actions                                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-source`          | Edit locally, export, optionally bind source                                                                                                                                                            |
| `source-unavailable` | Retry, open source URL, edit source metadata                                                                                                                                                            |
| `baseline-missing`   | Silently initialize baseline only when legacy hashes prove `L == R`; otherwise show “无法确定修改历史 (Unable to reconcile history)” and offer keep local as new baseline, reset from remote, or detach |
| `up-to-date`         | Refresh metadata, open source                                                                                                                                                                           |
| `update-available`   | Update from source                                                                                                                                                                                      |
| `local-modified`     | Keep local, create snapshot, reset from source with confirmation, detach from source                                                                                                                    |
| `conflict`           | Compare versions, force source overwrite, keep local and detach, postpone                                                                                                                               |

## Affected Areas

### Data Model

- `packages/shared/types/skill.ts`: add fields and result types.
- `packages/db/src/schema.ts`: add new columns for fresh installs.
- `packages/db/src/init.ts`: add migration columns for existing users.
- Backup/restore services: preserve new source baseline fields.

### Shared Utilities

- `packages/shared/utils/skill-identity.ts`: upgrade fingerprint algorithm or add `sha256` variant while preserving legacy comparison.
- Ensure desktop main, renderer, CLI, and remote store adapters call the same ignore predicate.

### Desktop Main

- Add staging materialization and atomic replace helpers.
- Add IPC for structured source check/update if renderer-only implementation is insufficient.
- Ensure remote fetch/clone uses proxy/source validation policy and blocks path traversal.

### Renderer Store

- Replace `RegistrySkillUpdateCheck` with or wrap it in `SkillSourceUpdateCheck`.
- Stop using only `installed_content_hash` for package-capable sources.
- Add status-specific UI state and actions.

### UI

- Detail page update button becomes stateful.
- Conflict and local-modified states must not use the same primary affordance as update-available.
- Store cards and detail page must share the same source check selector.

### CLI

- CLI skill update/check commands should use the same reconciliation service after desktop implementation stabilizes.

## Migration Strategy

1. Add nullable columns.
2. Backfill `fingerprint_algorithm = legacy-stable-text-v1` for rows with existing `directory_fingerprint`.
3. Do not blindly copy `directory_fingerprint` into `installed_directory_fingerprint`.
4. On first source check:
   - if `installed_directory_fingerprint` is empty, compare legacy `installed_content_hash` or old local `SKILL.md` hash against resolved remote `SKILL.md` hash
   - if the legacy entry hashes match, compute local and remote package fingerprints with `skill-package-sha256-v1`, initialize both current and installed fields, and set `fingerprint_algorithm = skill-package-sha256-v1` silently
   - if the legacy entry hashes do not match, report `baseline-missing`
5. Preserve all old fields for compatibility.

## `DES-SU-011` ClawHub Page Adapter

ClawHub page URLs are registry identities, not Git remotes. The renderer parses
supported `clawhub.ai` page shapes into an owner and slug, then derives the
canonical `SKILL.md` content endpoint and package zip endpoint. Store-backed and
installed-source checks share these helpers so a missing store row cannot send
the page URL through Git package resolution.

## `DES-SU-012` Source Diagnostics

The resolver owns source-kind classification and safe display references. The
reconciliation result carries that classification plus sanitized failures to
the UI without exposing credentials or internal stack traces.

## `DES-SU-013` Transport-Specific Source Snapshots

The source resolver produces one canonical Git package descriptor containing
repository URL, branch, and package directory. Renderer checks pass that
descriptor to a main-process snapshot IPC. Main clones into temporary storage,
validates the materialized Skill package, reads `SKILL.md`, computes the shared
v1 package fingerprint, returns the immutable snapshot, and removes staging.

This snapshot is used for both remote content and package comparison so a Git
check does not first call the raw HTTP adapter and does not clone twice. Local
directory and raw content sources retain their existing dedicated adapters.
Private-network access remains disabled for the generic HTTP adapter; only the
explicit Git transport may access a user-selected private Gitea endpoint.

## `DES-SU-014` Unified Package Snapshot Adapters

The typed package snapshot contract is shared by local, Git, and ZIP adapters.
Main-process adapters validate the materialized package, enumerate its files
once, and derive both root `SKILL.md` content and the v1 package fingerprint
from that inventory. Git clones and ZIP extraction use temporary staging;
external local sources use the same validated reader without copying.

The renderer resolves source precedence before transport selection. A concrete
local path persisted on an installed Skill wins over catalog identity matches.
Hosted Git tree/blob/src/raw URLs recover a canonical descriptor, including
legacy raw-only records and percent-encoded branch/directory segments. ZIP
sources use the extracted-package snapshot. Only a source that cannot be
classified as local, Git, ZIP, Cloud, or ClawHub falls through to raw HTTP.

Authenticated Git descriptors may contain URL userinfo because the Git child
process needs it, but that value must not cross into source trust keys,
diagnostics, safety reports, or AI prompts. Those surfaces use the canonical
credential-free repository URL; Git stderr and timeout messages are sanitized
before propagation.

## `DES-SU-015` Bounded Repository Package Discovery

Directory catalogs may publish a repository and Skill selector without a
physical repository path. The renderer therefore persists only verified
catalog metadata and leaves `source_directory` unset when the catalog does not
provide it. Install operations already carry the Skill record; fingerprint and
snapshot IPC carry an explicit `skillName` selector. The main-process Git
materializer performs a breadth-first scan, bounded by depth and directory
count, and matches normalized `name`, `logical_name`, `variant_key`, folder
name, or parsed frontmatter name.

Remote repository discovery does not follow symlinks and reuses the shared
ignore predicate for generated/cache directories. A catalog-provided explicit
directory remains authoritative and is path-contained and validated directly;
fallback discovery is reserved for entries where the directory is genuinely
unknown.

## `DES-SU-016` Lifecycle-Wide Skill Selector

`SkillPackageOperationSource.remote-git` owns an optional `skillName` selector.
The renderer derives it from verified install name, display name, or slug only
when no explicit directory exists. Shared validation bounds it as metadata;
operation locking and fallback source identity include it so two Skills in one
repository do not collapse into one source.

The main process passes the selector into staging instead of relying on a
temporary Skill record's display name. Discovery first resolves exact parsed
frontmatter names, then folder-name aliases. Duplicate candidates are ranked by
standard Skill container location; unresolved ties fail explicitly. Name
normalization preserves Unicode letters and numbers and is identical for
installation, fingerprinting, and update snapshots.

## `DES-SU-017` Review-First Detail Update Flow

`useSkillSourceUpdate` owns the latest structured reconciliation check and a
single pending comparison state. The header always invokes `check`; it never
switches to an update button and never renders a separate overwrite button.

After a successful check, actionable statuses open the existing
`SkillStoreUpdateReviewDialog`, which renders the local/source line diff and
version context. Closing or choosing the local version clears only renderer
review state. Accepting the source version calls the existing source update
workflow with `overwriteLocalChanges` only for `local-modified`, `conflict`, or
`baseline-missing`. Safety review, staging, snapshot, rollback, and final
baseline persistence remain owned by the existing update workflow.

The dialog uses the renderer motion system's `duration-base` and `ease-enter`
tokens for a restrained backdrop fade plus panel fade/zoom/slide. The global
motion preference and `prefers-reduced-motion` rules remain authoritative, so
the transition becomes near-instant when motion is reduced or disabled.

## `DES-SU-018` Validated Package Inventory Diff

`SkillPackageSnapshot` carries an additive, bounded file inventory alongside
the existing root content and package fingerprint. The main process derives
the inventory from the exact validated buffers already used for fingerprinting
so the review cannot disagree with the package that will later be staged.
Each entry contains a normalized path, byte size, SHA-256 content digest,
binary/text classification, and bounded text content when it is safe to
preview. Ignored files, internal metadata, symlinks, and escaping paths remain
excluded by the existing package reader and validator.

The renderer resolves both the current installed package snapshot and the
latest source snapshot during a check. A pure package-diff helper joins files
by normalized path and produces added, modified, and removed rows. Text rows
provide independent line diffs; binary or preview-truncated rows expose safe
metadata. `content-url` snapshots declare `skill-md` scope so local auxiliary
files are not falsely presented as removals when the actual update operation
only replaces `SKILL.md`.

The comparison dialog owns only file selection and presentation. Source
resolution, validation, snapshot construction, update authorization, safety
review, staging, rollback, and persistence stay in their existing layers.

## `DES-SU-019` Shared-Repository Identity Guard

Installed-source catalog recovery uses ordered exact fields: source id,
content URL, then registry slug. Repository URL is only a fallback candidate
set. A single repository match is accepted; multiple matches require one
uniquely highest verified directory/path or Skill-name score. Ties do not pick
the first entry. Once an exact candidate produces an `up-to-date` check, the
existing baseline refresh transaction also repairs non-empty canonical source
metadata so stale ids and display-truncated URLs do not keep influencing later
checks.

Remote Git snapshots return the validated repository-relative directory that
was selected by bounded package discovery. The renderer attaches that resolved
directory and its canonical `SKILL.md` path to the reconciled registry entry
before the baseline transaction runs. Legacy guessed paths are therefore
repaired from the exact package that was fingerprinted, not from a catalog
display label or a renderer-side path guess.

The skills.sh adapter accepts a Repository label only when it is a complete
GitHub owner/repository slug. Labels containing ellipsis or other display
truncation fall back to the canonical owner and repository parsed from the
skills.sh detail path.

## Verification Strategy

Required test layers:

- Shared unit tests for source identity, ignore rules, content hash, package fingerprint, legacy migration behavior.
- DB migration tests for new columns and backup/restore.
- Renderer store tests for all status matrix rows.
- Main-process filesystem tests for staging, atomic replace, rollback, path traversal, symlink behavior.
- Remote source tests for GitHub, Gitea, SSH Git, zip, raw content URL, unavailable source.
- Directory-catalog tests for nested category layouts, ambiguous identities,
  discovery limits, and a real public repository materialization smoke.
- UI component tests for detail button/badges/actions per status.
- Integration smoke for install -> local edit -> check -> conflict/update paths.

## Tradeoffs

### SHA-256 Instead Of MD5

MD5 is familiar as a phrase, but it is not appropriate as a durable identity contract. SHA-256 avoids collision concerns and can still be displayed as a short fingerprint in UI.

### Explicit Columns Instead Of JSON Only

Explicit columns make update queries, migrations, backup diff, and tests easier. A JSON snapshot can be added later for diagnostics.

### No Automatic Merge

Automatic three-way merge would be risky because Skill packages include scripts, assets, examples, and frontmatter. First implementation should block conflicts and require explicit user resolution.

### Do Not Infer Git Upstream For Linked Local Sources

Inferring upstream from arbitrary local folders can surprise users and create credential/network behavior they did not request. Explicit source metadata is safer.

## Design Conflicts And Decisions

- Current docs already require full package fingerprint and explicit ignore rules. This design reinforces that stable contract.
- Current code tracks current `directory_fingerprint` but lacks installed package baseline. This design records that as a required schema change rather than trying to infer from existing fields.
- Current `computeStableTextHash` is deterministic but not SHA-256. This design treats it as legacy and introduces algorithm versioning.
- `source-moved` is deferred from v1. Canonical source identity changes are handled as manual detach/rebind or `baseline-missing` until a future lineage design exists.
- `downstream-stale` is not a `SkillSourceUpdateStatus`; it is a distribution/topology signal exposed through auxiliary result fields and distribution scan rows.

## Traceability

| Requirement | Design                     | Verification                 |
| ----------- | -------------------------- | ---------------------------- |
| `FR-SU-001` | `DES-SU-001`               | `TEST-SU-001`                |
| `FR-SU-002` | `DES-SU-002`               | `TEST-SU-002`                |
| `FR-SU-003` | `DES-SU-003`               | `TEST-SU-003`                |
| `FR-SU-004` | `DES-SU-004`               | `TEST-SU-004`                |
| `FR-SU-005` | `DES-SU-005`               | `TEST-SU-005`                |
| `FR-SU-006` | `DES-SU-006`               | `TEST-SU-006`                |
| `FR-SU-007` | `DES-SU-007`               | `TEST-SU-007`                |
| `FR-SU-008` | `DES-SU-008`               | `TEST-SU-008`                |
| `FR-SU-009` | `DES-SU-009`               | `TEST-SU-009`                |
| `FR-SU-010` | `DES-SU-010`               | `TEST-SU-010`                |
| `FR-SU-011` | `DES-SU-003`, `DES-SU-004` | `TEST-SU-011`                |
| `FR-SU-012` | `DES-SU-005`, `DES-SU-006` | `TEST-SU-012`                |
| `FR-SU-013` | `DES-SU-011`               | `TEST-SU-013`                |
| `FR-SU-014` | `DES-SU-012`               | `TEST-SU-014`                |
| `FR-SU-015` | `DES-SU-013`               | `TEST-SU-016`                |
| `FR-SU-016` | `DES-SU-014`               | `TEST-SU-017`, `TEST-SU-018` |
| `FR-SU-017` | `DES-SU-015`               | `TEST-SU-019`                |
| `FR-SU-018` | `DES-SU-016`               | `TEST-SU-020`                |
| `FR-SU-019` | `DES-SU-017`               | `TEST-SU-021`                |
| `FR-SU-020` | `DES-SU-018`               | `TEST-SU-022`                |
| `FR-SU-021` | `DES-SU-019`               | `TEST-SU-023`                |
