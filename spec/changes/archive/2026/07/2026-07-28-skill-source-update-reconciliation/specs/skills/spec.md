# Skill Source Update Reconciliation Spec

## Added Requirements

### `FR-SU-001` Stable Source Identity

PromptHub must identify a Skill source by stable source metadata, not by display name, translated name, slug alone, or current UI row.

Stable source identity inputs, in priority order:

1. Explicit `source_id`.
2. Canonical tuple: source type, normalized source URL, branch, source directory, canonical `SKILL.md` path.
3. Linked local source tuple: normalized external local path plus package fingerprint.
4. Restored source metadata from backup/import.
5. Directory fingerprint only as an association hint for scanned project/agent rows, not as proof of remote identity.

### `FR-SU-002` Source Origin Separation

PromptHub must keep source origin separate from install/distribution mode.

- Source origin answers where the My Skills record came from.
- Install mode answers how a project or agent target has the Skill: copy, symlink, external, built-in.
- Updating My Skills from source must never mutate project/agent copied installs unless the user explicitly redistributes.

### `FR-SU-003` Three-Way Reconciliation

PromptHub must check Skill updates by comparing:

- `B`: baseline stored from the last successful source install/update.
- `L`: current local package content after syncing from the active `local_repo_path`.
- `R`: current source package content resolved from the source.

The update result must report both booleans:

- `localModified`: `L != B`
- `remoteChanged`: `R != B`

### `FR-SU-004` Package-Level Baseline

PromptHub must track both entry content and full package baseline.

- `installed_content_hash`: baseline hash for normalized `SKILL.md`.
- `installed_directory_fingerprint`: baseline fingerprint for the distributable Skill package.
- `directory_fingerprint`: current local package fingerprint.

`SKILL.md` content hash alone is insufficient for update detection.
For raw `content-url` sources that provide only a single `SKILL.md`, the package fingerprint must be represented as that normalized entry content hash so reconciliation can continue to use the same package-level fields without a source-specific status branch.

### `FR-SU-005` Deterministic Fingerprint Algorithm

PromptHub must use a deterministic package fingerprint algorithm with explicit versioning.

- v1 durable package fingerprints must use `skill-package-sha256-v1`.
- The database must use one `fingerprint_algorithm` field for both `directory_fingerprint` and `installed_directory_fingerprint`; when the algorithm changes, current and installed fingerprints must be recomputed as one compatible pair.
- The user-facing term may be “hash” or “fingerprint”; it must not imply MD5 if MD5 is not the stored algorithm.
- If legacy installs lack `installed_directory_fingerprint`, PromptHub must silently upgrade the baseline only when the old `installed_content_hash` / `SKILL.md` hash proves local `L` still matches remote `R`; otherwise it must return `baseline-missing`.

### `FR-SU-006` Ignore Local Environment Noise

Package fingerprinting must ignore local-only runtime, cache, secret, and tool output files.

Must ignore:

- `.git/`
- `.prompthub/`
- `node_modules/`
- generated caches such as `__pycache__`, `.pytest_cache`, `.mypy_cache`, `.ruff_cache`, `.vitest`, `.vite`, `.next`, `.turbo`
- dependency caches such as `.pnpm-store`, `.npm`, `.yarn/cache`
- temporary and log files such as `*.log`, `*.tmp`, `*.pid`, `*.sock`, swap files
- local secret files such as `.env`, `.env.local`, `.env.production`, `.env.*` except explicitly distributable templates

Must include:

- `.env.example`
- `.env.sample`
- `.env.template`
- hidden files that are distributable and not explicitly ignored
- scripts, assets, docs, examples, references, and other package resources

### `FR-SU-007` Update Status Matrix

PromptHub must expose the following source update statuses (excluding downstream stale check and redirect lineage which are decoupled from source update checks):

| Status               | Condition                                                                                 | User Meaning                                                | Default Action                                       |
| -------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| `no-source`          | no source metadata exists                                                                 | Skill is local/authored only                                | Hide source update action                            |
| `source-unavailable` | source metadata exists but cannot be reached or validated                                 | PromptHub cannot check source now                           | Keep local, show retry/source settings               |
| `baseline-missing`   | source exists but durable baseline is absent or legacy-only and cannot be safely inferred | PromptHub cannot tell whether local or source changed first | Ask user to initialize baseline or reset from source |
| `up-to-date`         | `L == B` and `R == B`                                                                     | local matches source baseline                               | No update; optionally refresh stale metadata         |
| `update-available`   | `L == B` and `R != B`                                                                     | source changed, local is pristine                           | Allow update from source                             |
| `local-modified`     | `L != B` and `R == B`                                                                     | user/local package changed                                  | Do not overwrite by default                          |
| `conflict`           | `L != B` and `R != B`                                                                     | local and source both changed                               | Require explicit resolution                          |

> [!NOTE]
> `source-moved` (lineage moves) and `downstream-stale` are not v1 source update status values.
> If canonical source identity changes, v1 treats it as a new binding decision or returns `baseline-missing`; automatic lineage matching is a future feature.
> Downstream staleness belongs to distribution scan/topology data and may be summarized on My Skills only through auxiliary fields such as `hasStaleTargets` and `staleTargets`.

### `FR-SU-008` Linked Local Source Handling

For linked local imports, the external directory is the My Skills content source of truth.

- Reading, editing, syncing, and fingerprinting must operate on the external `local_repo_path`.
- Deleting the My Skills record must not delete the external source directory.
- Checking remote source updates for a linked local source is allowed only when explicit remote source metadata exists.
- PromptHub must not infer Git upstream from a linked folder unless a later accepted design adds that behavior.
- PromptHub v1 must block direct remote overwrite updates to a `local-linked` external directory, even when the check result is `update-available` or `conflict`.
- When the user requests update on a linked external directory, the UI must guide them to either convert the Skill to a PromptHub-managed copy before updating, or manually pull/update the external folder in their editor or VCS tool.

### `FR-SU-009` Safe Update Application

Applying a source update must be rollback-aware.

Before mutating current local content, PromptHub must:

1. Create a version snapshot of the current package.
2. Materialize the remote/source package into a temporary location.
3. Validate `SKILL.md`, source identity, ignore rules, and fingerprint.
4. Perform safety scans on the staged temporary package directory before writing to the final managed path. If high-severity security issues are detected, block the update, surface the warning, cleanup staging, and leave the original package and DB baseline untouched.
5. Atomically replace or copy into the managed package path only after validation and safety scan pass.
6. Update DB baseline fields after filesystem success.

If any step fails, the previous local package and DB row must remain usable.

### `FR-SU-010` User Resolution Actions

PromptHub must expose different actions per status:

- `update-available`: update from source.
- `local-modified`: keep local, reset from source, or detach/mark as local copy.
- `conflict`: show diff or version comparison, update from source with explicit overwrite, keep local and postpone, or detach from source.
- `baseline-missing`: initialize baseline silently only when legacy hashes prove `L == R`; otherwise show a clear prompt titled “无法确定修改历史 (Unable to reconcile history)” with the description “由于此技能是从旧版本升级而来，我们无法确认您是否对本地文件进行了修改。为了避免覆盖您可能做出的调整，请选择后续操作：”
- `baseline-missing` prompt actions: “保留本地修改并建立基准 (Keep local changes as new baseline)”, “重置为来源版本（覆盖本地） (Reset from remote source)”, and “解除与来源的绑定 (Detach from source)”.
- `source-unavailable`: retry, open source URL, edit source metadata.

## Modified Requirements

### `FR-SU-011` Existing Store Update Checks

Existing store update checks must continue to preserve imported state by source identity, but they must compare complete package baseline when package metadata exists.

### `FR-SU-012` Existing Fingerprint Contract

Existing directory fingerprint ignore rules remain the baseline, but implementation must document algorithm version and use the same implementation in desktop main, renderer, CLI, remote store adapters, and tests.

### `FR-SU-013` ClawHub Page Source Resolution

An installed ClawHub page URL must resolve through ClawHub content and package
API endpoints. PromptHub must not treat a ClawHub page URL as a Git repository
or reuse an installed local package fingerprint as a remote fingerprint when a
store entry is unavailable.

### `FR-SU-014` Source Failure Diagnostics

Source update failures must preserve the resolved adapter kind, a sanitized
source reference, and a sanitized failure reason so local paths, Git
repositories, archives, content URLs, and stores are not collapsed into a
generic URL failure.

### `FR-SU-015` Source Transport Fidelity

Update checks must read each source through its owning transport.

- Local directory sources read `SKILL.md` and package files from that directory.
- Git-backed sources, including explicitly configured private-network Gitea
  repositories, clone and validate the selected repository package before
  comparing its `SKILL.md` and package fingerprint.
- Raw content URLs use the SSRF-protected HTTP content adapter.
- A Git-backed source must not be downgraded to the raw content adapter merely
  because the registry also stores a `content_url`.
- Generic remote content fetching must continue to reject private-network
  addresses; private-network access is limited to the explicit Git transport.

### `FR-SU-016` Source Precedence And Package Snapshot Consistency

Source identity recovery and comparison must remain stable for legacy and
mixed-catalog records.

- A concrete local source path stored on an imported Skill is authoritative
  over a remote catalog entry that happens to reuse the same `source_id`.
- Hosted Git raw/file URLs must recover the canonical repository, decoded
  branch, and package directory even when legacy rows lack `source_url`,
  `source_branch`, or `source_directory`.
- Local, Git, and ZIP adapters must return entry content and the complete
  package fingerprint from one validated package inventory.
- ZIP-backed checks must inspect the extracted package rather than combining
  cached registry content with an unrelated or missing directory fingerprint.
- Authenticated Git sources must retain clone credentials only on the Git
  transport path. Review identities, diagnostics, and AI safety prompts must
  redact URL userinfo, secret query values, and fragments.

### `FR-SU-017` Directory Catalog Package Discovery

A directory-style catalog such as skills.sh must not invent an unverified
repository subdirectory from the repository name or Skill slug. When the
catalog provides only a repository plus Skill identity, install, fingerprint,
and update-snapshot flows must carry that identity to the main process, clone
the repository, and locate the package by exact normalized folder/frontmatter
identity within a bounded recursive scan. Remote discovery must not follow
symlinks, must skip ignored generated directories, and must fail explicitly
when no package or multiple matching packages are found.

## Removed Requirements

- None.

## Reconciliation Scenarios

### Scenario `SC-SU-001`: Local authored Skill has no source

Given a Skill has no `source_id`, `source_url`, `content_url`, or external source metadata
When the user checks for source updates
Then PromptHub returns `no-source`
And no source update action is shown.

### Scenario `SC-SU-002`: Remote update with pristine local package

Given `L == B`
And `R != B`
When PromptHub checks for source updates
Then it returns `update-available`
And update from source creates a version snapshot before applying `R`.

### Scenario `SC-SU-003`: User modified current Skill directly

Given `L != B`
And `R == B`
When PromptHub checks for source updates
Then it returns `local-modified`
And PromptHub must not overwrite local content without explicit user confirmation.

### Scenario `SC-SU-004`: Local and remote both changed

Given `L != B`
And `R != B`
When PromptHub checks for source updates
Then it returns `conflict`
And PromptHub requires explicit resolution.

### Scenario `SC-SU-005`: Non-SKILL resources changed remotely

Given local `SKILL.md` content hash matches baseline
And remote `SKILL.md` content hash matches baseline
And remote package fingerprint differs from `installed_directory_fingerprint`
When PromptHub checks for source updates
Then it returns `update-available`.

### Scenario `SC-SU-006`: Cache and local env files change

Given the only local changes are ignored files such as `.env.local`, `__pycache__/`, `.pytest_cache/`, `node_modules/`, or `*.log`
When PromptHub recomputes package fingerprint
Then `directory_fingerprint` does not change.

### Scenario `SC-SU-007`: Distributable env template changes

Given `.env.example`, `.env.sample`, or `.env.template` changes
When PromptHub recomputes package fingerprint
Then `directory_fingerprint` changes.

### Scenario `SC-SU-008`: Source unavailable

Given source metadata exists
And remote source fetch, clone, registry parse, or package validation fails
When PromptHub checks for source updates
Then it returns `source-unavailable`
And does not mutate local package or baseline fields.

### Scenario `SC-SU-009`: Baseline missing for legacy install

Given source metadata exists
And `installed_directory_fingerprint` is absent
And the row has legacy `installed_content_hash` or old `SKILL.md` hash data
When PromptHub checks for source updates
Then it compares legacy local entry content against remote entry content
And if legacy entry hashes match, it silently computes `skill-package-sha256-v1` fingerprints for local and remote, writes `installed_directory_fingerprint`, `directory_fingerprint`, and `fingerprint_algorithm`, and returns `up-to-date`
Otherwise it returns `baseline-missing`.

### Scenario `SC-SU-010`: Linked local source

Given a Skill has `local_repo_path` pointing outside PromptHub managed repos
When PromptHub syncs or fingerprints the Skill
Then it reads the external directory
And does not copy it into PromptHub managed storage unless the user explicitly converts import mode.

### Scenario `SC-SU-011`: Raw content URL behaves as single-file package

Given a Skill source is a raw `content-url` that resolves only one `SKILL.md`
When PromptHub computes package reconciliation snapshots
Then the package fingerprint equals the normalized `installed_content_hash` / current content hash for that single file
And no directory walk-specific status branch is required.

### Scenario `SC-SU-012`: Downstream copied installs are reported separately

Given a My Skills package is updated from source
And one or more project/agent target installs are copies, not symlinks
When target scans run
Then copied targets whose fingerprint differs from My Skills source are labeled as stale in the distribution scan report or returned through auxiliary `hasStaleTargets` / `staleTargets` fields
And PromptHub offers redistribution via the distribution view instead of changing the My Skills source update status.

### Scenario `SC-SU-013`: Installed ClawHub page resolves without a store row

Given an installed Skill has a ClawHub page URL and the current store result no
longer contains that Skill
When PromptHub checks for source updates
Then it derives the ClawHub slug from the page URL
And fetches the ClawHub `SKILL.md` and package zip API endpoints
And never attempts to clone the page URL as Git.

### Scenario `SC-SU-014`: Source failure identifies its adapter

Given a source check fails after source resolution
When PromptHub reports `source-unavailable`
Then it includes the resolved adapter kind, sanitized source reference, and
sanitized failure reason.

### Scenario `SC-SU-015`: Private Gitea update uses a Git package snapshot

Given an installed Skill is bound to an explicitly configured private-network
Gitea repository
And the registry entry also contains a raw `content_url`
When PromptHub checks or applies a source update
Then it clones the repository through the Git transport
And compares the selected package's `SKILL.md` plus package fingerprint
And it does not call the generic remote content fetcher for the Gitea raw URL.

### Scenario `SC-SU-016`: Legacy raw-only Git source recovers its repository

Given a legacy Skill retains only a GitHub or Gitea raw `SKILL.md` URL
When PromptHub checks for source updates
Then it derives the canonical repository, branch, and package directory
And it uses the Git snapshot adapter rather than generic HTTP.

### Scenario `SC-SU-017`: Local source wins over a colliding catalog entry

Given a copied Agent Skill stores a concrete external local source path
And a loaded catalog entry reuses the same `source_id`
When the user checks the installed Skill source
Then PromptHub reads and fingerprints the local directory
And it does not clone or fetch the catalog source.

### Scenario `SC-SU-018`: ZIP source check uses extracted package bytes

Given a registry Skill has a package archive URL
When PromptHub checks for source updates
Then one validated extracted package supplies both `SKILL.md` and the complete
package fingerprint
And cached registry content is not mixed with the extracted package state.

### Scenario `SC-SU-019`: Authenticated Git transport does not disclose credentials

Given a private Git source uses URL userinfo for clone authentication
When PromptHub resolves, checks, scans, or reports a package failure
Then the Git clone descriptor retains the credentials needed by Git
And the safety prompt, trusted-source identity, and failure diagnostic contain
only the credential-free canonical repository URL.

### Scenario `SC-SU-020`: skills.sh package uses nested categories

Given skills.sh identifies `grill-me` in `mattpocock/skills`
And the repository stores it at `skills/productivity/grill-me`
When the user installs the catalog entry or checks its source snapshot
Then the renderer does not guess `skills/grill-me`
And it sends `grill-me` as the package selector
And the main process discovers the exact package recursively for both flows
And the validated complete package is materialized successfully.

### `FR-SU-018` Stable Multi-Skill Repository Selection

PromptHub must carry one explicit Skill selector across source resolution,
package-operation validation, installation, fingerprinting, and update
snapshots whenever a Git repository contains more than one Skill and no
verified physical directory is available.

- The selector is part of fallback source identity when `source_id` is absent.
- Exact parsed frontmatter names take precedence over folder-name aliases.
- Standard Skill container paths take precedence over unrelated examples or
  fixtures when duplicate names exist.
- Unicode letters and numbers remain significant during name normalization.
- A still-ambiguous result must fail without installing an arbitrary package.

### Scenario `SC-SU-021`: selector remains stable across the lifecycle

Given a repository contains multiple Skills and the catalog supplies a Skill
selector but no verified directory
When PromptHub installs, checks, or updates that Skill
Then the same selector crosses the renderer, shared contract, main-process
staging, fingerprint, and snapshot boundaries
And fallback source identities distinguish two selected Skills from the same
repository
And duplicate names in unrelated example directories cannot override the
standard Skill package.

### `FR-SU-019` Single Review-First Update Entry

The installed Skill detail header must expose one source action only: check
for updates. A completed check must not add a second update or overwrite action
to the header.

- `update-available`, `local-modified`, `conflict`, and `baseline-missing`
  checks open a comparison dialog before any source content is applied.
- The dialog identifies the Skill and compares the current local package with
  the latest resolved source package. Catalog version labels are not shown as
  decision metadata when the actual decision is package-content based.
- The user can keep the local version, accept the source version, or close the
  dialog without mutating either side.
- The comparison enters with the shared modal motion tokens and continues to
  honor the operating-system and in-app reduced-motion preferences.
- Accepting the source version uses overwrite authorization only when local
  changes or an uncertain baseline require it.
- `up-to-date`, `no-source`, and `source-unavailable` remain non-mutating status
  results and do not open a misleading update dialog.

### Scenario `SC-SU-022`: local changes are reviewed after checking

Given an installed Skill has source metadata and local changes
When the user clicks the single check-update action
Then PromptHub opens a local-versus-source comparison dialog
And no overwrite button appears in the detail header
And keeping the local version performs no update
And accepting the source version invokes the existing rollback-aware update
with explicit overwrite authorization.

### `FR-SU-020` Complete Package Difference Review

The source update review must describe the complete effective package change,
not only the root `SKILL.md` change.

- Package-backed local, Git, ZIP, store, and Cloud sources expose the complete
  validated file inventory used to calculate the package fingerprint.
- The review lists every added, modified, and removed file and lets the user
  inspect each changed text file independently before accepting the source.
- Binary or oversized text files remain in the complete change list with size
  and digest-based change metadata; they are not decoded or rendered as unsafe
  text merely to produce a preview.
- Single-file `content-url` sources compare only `SKILL.md`, because applying
  that source does not delete unrelated local package files.
- Snapshot payloads are bounded and never include ignored, internal, symlinked,
  or path-escaping entries.

### Scenario `SC-SU-023`: auxiliary package files are reviewable

Given a package-backed Skill changes `SKILL.md`, modifies a reference file,
adds a script, removes a template, and replaces a binary asset
When the user checks for a source update
Then the comparison lists all five effective file changes
And selecting either changed text file shows its complete bounded line diff
And the binary change shows safe metadata instead of corrupted text
And accepting or keeping a version retains the existing update semantics.

### `FR-SU-021` Exact Skill Identity Within Shared Repositories

Source reconciliation must never select a sibling Skill merely because it
shares the same repository URL. Exact source id, content URL, registry slug,
verified directory/path, and unique Skill identity take precedence; an
ambiguous repository-only match must fall back to the installed source binding
instead of choosing the first catalog entry. Successful exact reconciliation
may repair stale source metadata, including the repository-relative directory
discovered by the validated remote snapshot. Truncated repository labels from
catalog UI must never be persisted as canonical Git URLs.

The update review identifies the Skill being compared but does not render
local/source version cards for source-driven packages whose version labels do
not describe the actual package decision.

### Scenario `SC-SU-024`: sibling Skills cannot cross-update

Given `image-to-video` and `video-edit` share one Git repository
And an older installed row has a stale source id and truncated repository URL
When the user checks `image-to-video` for updates
Then PromptHub selects `image-to-video` by its stable registry slug or exact
package identity
And it never compares or installs `video-edit`
And an up-to-date result repairs the installed source id, canonical URL,
resolved directory, and canonical `SKILL.md` path.

## Traceability

| Requirement | Scenarios                                          | Design                     | Verification                 | Task       |
| ----------- | -------------------------------------------------- | -------------------------- | ---------------------------- | ---------- |
| `FR-SU-001` | `SC-SU-001`, `SC-SU-010`                           | `DES-SU-001`               | `TEST-SU-001`                | `T-SU-001` |
| `FR-SU-002` | `SC-SU-012`                                        | `DES-SU-002`               | `TEST-SU-002`                | `T-SU-002` |
| `FR-SU-003` | `SC-SU-002`, `SC-SU-003`, `SC-SU-004`              | `DES-SU-003`               | `TEST-SU-003`                | `T-SU-003` |
| `FR-SU-004` | `SC-SU-005`, `SC-SU-011`                           | `DES-SU-004`               | `TEST-SU-004`                | `T-SU-004` |
| `FR-SU-005` | `SC-SU-006`, `SC-SU-007`, `SC-SU-009`, `SC-SU-011` | `DES-SU-005`               | `TEST-SU-005`                | `T-SU-005` |
| `FR-SU-006` | `SC-SU-006`, `SC-SU-007`                           | `DES-SU-006`               | `TEST-SU-006`                | `T-SU-006` |
| `FR-SU-007` | `SC-SU-001` through `SC-SU-010`                    | `DES-SU-007`               | `TEST-SU-007`                | `T-SU-007` |
| `FR-SU-008` | `SC-SU-010`                                        | `DES-SU-008`               | `TEST-SU-008`                | `T-SU-008` |
| `FR-SU-009` | `SC-SU-002`, `SC-SU-008`                           | `DES-SU-009`               | `TEST-SU-009`                | `T-SU-009` |
| `FR-SU-010` | `SC-SU-003`, `SC-SU-004`, `SC-SU-009`              | `DES-SU-010`               | `TEST-SU-010`                | `T-SU-010` |
| `FR-SU-011` | `SC-SU-002`, `SC-SU-005`                           | `DES-SU-003`, `DES-SU-004` | `TEST-SU-011`                | `T-SU-021` |
| `FR-SU-012` | `SC-SU-006`, `SC-SU-007`                           | `DES-SU-005`, `DES-SU-006` | `TEST-SU-012`                | `T-SU-022` |
| `FR-SU-013` | `SC-SU-013`                                        | `DES-SU-011`               | `TEST-SU-013`                | `T-SU-023` |
| `FR-SU-014` | `SC-SU-014`                                        | `DES-SU-012`               | `TEST-SU-014`                | `T-SU-024` |
| `FR-SU-015` | `SC-SU-015`                                        | `DES-SU-013`               | `TEST-SU-016`                | `T-SU-026` |
| `FR-SU-016` | `SC-SU-016` through `SC-SU-019`                    | `DES-SU-014`               | `TEST-SU-017`, `TEST-SU-018` | `T-SU-027` |
| `FR-SU-017` | `SC-SU-020`                                        | `DES-SU-015`               | `TEST-SU-019`                | `T-SU-028` |
| `FR-SU-018` | `SC-SU-021`                                        | `DES-SU-016`               | `TEST-SU-020`                | `T-SU-029` |
| `FR-SU-019` | `SC-SU-022`                                        | `DES-SU-017`               | `TEST-SU-021`                | `T-SU-030` |
| `FR-SU-020` | `SC-SU-023`                                        | `DES-SU-018`               | `TEST-SU-022`                | `T-SU-031` |
| `FR-SU-021` | `SC-SU-024`                                        | `DES-SU-019`               | `TEST-SU-023`                | `T-SU-032` |
