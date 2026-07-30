# Tasks

## Documentation

- [x] `T-SU-001`: Define stable Skill source identity requirements and source origin boundaries. Covers `FR-SU-001`, `DES-SU-001`, `TEST-SU-001`.
- [x] `T-SU-002`: Define source origin versus install mode and auxiliary downstream stale distribution signals. Covers `FR-SU-002`, `DES-SU-002`, `TEST-SU-002`.
- [x] `T-SU-003`: Define three-way baseline/local/remote reconciliation states. Covers `FR-SU-003`, `DES-SU-003`, `TEST-SU-003`.
- [x] `T-SU-004`: Define package-level baseline fields. Covers `FR-SU-004`, `DES-SU-004`, `TEST-SU-004`.
- [x] `T-SU-005`: Define hash/fingerprint algorithm and legacy migration behavior. Covers `FR-SU-005`, `DES-SU-005`, `TEST-SU-005`.
- [x] `T-SU-006`: Define ignore rules for local env, cache, generated files, and distributable templates. Covers `FR-SU-006`, `DES-SU-006`, `TEST-SU-006`.
- [x] `T-SU-007`: Define source update status and UI action matrix. Covers `FR-SU-007`, `DES-SU-007`, `TEST-SU-007`.
- [x] `T-SU-008`: Define linked local source behavior. Covers `FR-SU-008`, `DES-SU-008`, `TEST-SU-008`.
- [x] `T-SU-009`: Define safe update apply, version snapshot, staging, atomic replace, and rollback. Covers `FR-SU-009`, `DES-SU-009`, `TEST-SU-009`.
- [x] `T-SU-010`: Define user resolution actions. Covers `FR-SU-010`, `DES-SU-010`, `TEST-SU-010`.

## Implementation Tasks

- [x] `T-SU-011`: Add shared `SkillSourceUpdateStatus`, `SkillSourceSnapshot`, `SkillSourceUpdateCheck`, and `SkillSourceUpdateResult` types.
- [x] `T-SU-012`: Add DB columns and migration for `installed_directory_fingerprint`, `fingerprint_algorithm`, `source_last_checked_at`, `source_last_error`, and `source_binding_state`.
- [x] `T-SU-013`: Upgrade package fingerprint utility to support `skill-package-sha256-v1` while preserving `legacy-stable-text-v1` comparison for existing rows.
- [x] `T-SU-014`: Centralize ignore rules so desktop main, renderer, CLI, and store loaders use one predicate.
- [x] `T-SU-015`: Implement source resolver adapters for remote store, remote Git, remote zip, raw content URL, local linked source, and managed copy; raw content URL must expose a single-file package fingerprint equal to normalized content hash.
- [x] `T-SU-016`: Implement reconciliation service that computes `B/L/R`, status, localModified, remoteChanged, and sanitized errors.
- [x] `T-SU-017`: Implement safe update apply with version snapshot, temp staging, validation, safety scan before final write, atomic replace, DB commit, staging cleanup, and rollback.
- [x] `T-SU-018`: Update renderer store and Skill detail UI to show status-specific actions, baseline-missing wording, and block implicit overwrite.
- [x] `T-SU-019`: Update project/agent scan status and `SkillSourceUpdateCheck` auxiliary fields to surface stale copied targets without adding `downstream-stale` to the source status enum.
- [x] `T-SU-020`: Sync stable docs after implementation lands.
- [x] `T-SU-021`: Update existing store update checks to use complete package baselines when package metadata exists.
- [x] `T-SU-022`: Update existing fingerprint callers to record and respect fingerprint algorithm versions.
- [x] `T-SU-023`: Resolve installed ClawHub page sources through the ClawHub
      content/package APIs instead of Git. Covers `FR-SU-013`, `DES-SU-011`,
      `TEST-SU-013`.
- [x] `T-SU-024`: Preserve source adapter kind, source location, and sanitized
      failure reason in `source-unavailable` checks; show local and remote source
      diagnostics in update feedback. Covers `FR-SU-014`, `DES-SU-012`,
      `TEST-SU-014`.
- [x] `T-SU-025`: Make local Agent copy imports updateable by binding external
      symlink scans to their concrete source target, aligning package validation,
      copy, and fingerprint ignore rules, and exposing source actions on managed
      Agent detail views. Covers `FR-SU-002`, `FR-SU-006`, `FR-SU-007`,
      `DES-SU-002`, `DES-SU-006`, `DES-SU-007`, `TEST-SU-015`.
- [x] `T-SU-026`: Route Git-backed checks and updates through a validated
      main-process package snapshot, including private-network Gitea, without
      weakening generic HTTP SSRF protection. Covers `FR-SU-015`, `DES-SU-013`,
      `TEST-SU-016`.
- [x] `T-SU-027`: Reconcile legacy raw-only Git locations, local-source
      precedence, and local/Git/ZIP same-inventory snapshots. Covers
      `FR-SU-016`, `DES-SU-014`, `TEST-SU-017`.
- [x] `T-SU-028`: Stop directory catalogs from guessing repository paths and
      add bounded recursive package discovery for nested repositories. Covers
      `FR-SU-017`, `DES-SU-015`, `TEST-SU-019`.

Progress note 2026-07-07: `T-SU-016` is closed for registry/source update checks through the shared `buildSkillSourceUpdateCheck()` reconciliation builder; sanitized source errors remain recorded at the renderer side-effect boundary. `T-SU-017` is still not complete enough to close. Implemented safe-apply slices include non-local remote source materialization before metadata baseline writes, staged safety preflight for remote package writes, and managed repo staging/backup swap on partial copy failure. `T-SU-022` is closed for durable DB writes; remaining DTO-only fingerprints intentionally do not carry the DB algorithm field.

Progress note 2026-07-07: `T-SU-020` is partially synced. Updated `spec/knowledge/behavior/skills.md` and `spec/knowledge/reference/skill-regression-test-matrix.md` for the implemented source update slices; leave the task open until resolver/downstream/final rollback scope is complete.

Progress note 2026-07-08: `T-SU-015` is closed. Added a renderer source resolver adapter boundary that classifies `remote-store`, `remote-git`, `remote-zip`, `content-url`, `local-linked`, and `managed-copy`; the store now uses that boundary for source checks. Raw `content-url` checks normalize the remote package fingerprint to the fetched `SKILL.md` content hash even when registry metadata carries a stale directory fingerprint.

Progress note 2026-07-08: `T-SU-020` is closed. Stable docs were advanced for the resolver layer, raw content-url safety/rollback behavior, and v1 package fingerprint algorithm semantics. Updated `spec/knowledge/behavior/skills.md`, `spec/knowledge/reference/skill-regression-test-matrix.md`, and `spec/knowledge/structure/skill-system-design.md`.

Progress note 2026-07-08: `T-SU-017` is closed. Remote Git/Zip sources stage and safety-scan before managed repo replacement; managed repo replacement uses staging/backup rollback; raw content-url updates safety-scan before writing `SKILL.md` and roll back through the version snapshot if the final DB baseline write fails.

Progress note 2026-07-08 review follow-up: external review found tree/API paths still deriving legacy blob-hash manifests as `directory_fingerprint`. Main and renderer registry tree loaders now leave package fingerprints empty unless a v1 package hash is available; content-url install baselines use the content hash; source error sanitization strips URL userinfo; DB migration marks existing directory fingerprints as `legacy-stable-text-v1`.

Progress note 2026-07-09 regression follow-up: ClawHub page URLs are not Git repositories. Installed ClawHub sources now derive `content_url` and `package_url` from the page slug, avoid Git package fingerprint checks, and do not reuse the installed local package fingerprint as the remote package fingerprint when the store entry is absent.

Progress note 2026-07-13 proxy compatibility follow-up: remote text and byte
fetches now recognize active proxy-generated `198.18/15` DNS answers for
arbitrary public source hostnames, preserve the original hostname for proxy
routing, and continue to reject real private addresses. Added focused install,
update, binary-fetch, and SSRF regression coverage.

Progress note 2026-07-13 source diagnostics follow-up: `source-unavailable`
checks now preserve the resolver adapter kind, a sanitized local path or
remote source reference, and the sanitized failure reason. Skill detail and
full-detail update actions show those fields instead of implying every source
is a URL. Added local-directory, mixed local/remote metadata, invalid
`file://`, and component toast regressions.

Progress note 2026-07-13 Agent local source follow-up: copied Agent imports now
persist the concrete target of an external symlink as `source_url` and
`source_id`, while keeping the copied Agent shortcut as the distribution path.
Local package validation and copy now share the fingerprint ignore predicate,
so dependency/runtime output cannot make an otherwise valid local source
unavailable. Managed non-builtin Agent detail views expose the same source
check/update actions as My Skills without exposing unrelated library CRUD
actions.

## Verification Tasks

- [x] `TEST-SU-001`: Unit tests for source identity precedence and same-name different-source separation.
- [x] `TEST-SU-002`: Component/service tests proving source update does not mutate project/agent copy installs.
- [x] `TEST-SU-003`: Unit tests for all `B/L/R` reconciliation status rows.
- [x] `TEST-SU-004`: DB and store tests proving non-`SKILL.md` resource changes affect package baseline.
- [x] `TEST-SU-005`: Unit tests for `skill-package-sha256-v1`, raw content URL single-file package fingerprints, and silent legacy baseline refresh only when old entry hashes match remote.
- [x] `TEST-SU-006`: Fuzz/boundary tests for ignore rules, including `.env.local` ignored and `.env.example` included.
- [x] `TEST-SU-007`: UI component tests for each status badge/action.
- [x] `TEST-SU-008`: Linked local source tests proving external folder is read directly, never deleted, and remote overwrite is blocked in v1 with convert/manual-update guidance.
- [x] `TEST-SU-009`: Main-process filesystem tests for staging, safety scan blocking before final write, rollback, path traversal, symlink handling, and partial failure.
- [x] `TEST-SU-010`: Integration tests for update-available, local-modified, conflict, baseline-missing, source-unavailable, and auxiliary stale target reporting.
- [x] `TEST-SU-011`: Regression tests proving existing store update checks still preserve imported state while detecting package resource updates.
- [x] `TEST-SU-012`: Regression tests proving legacy fingerprints are migrated only when local and source packages match.
- [x] `TEST-SU-013`: Regression tests proving store-backed and missing-store
      ClawHub updates use package APIs and never Git-clone page URLs.
- [x] `TEST-SU-014`: Regression tests proving source-unavailable feedback
      identifies local and remote source locations and preserves sanitized reasons.
- [x] `TEST-SU-015`: Regression tests proving copied Agent local sources remain
      updateable after source changes, external symlink imports bind to the real
      source target, ignored dependency files do not trip package limits or copy
      into managed repos, and managed Agent detail exposes source actions.
- [x] `TEST-SU-016`: Regression tests proving private-network Gitea checks read
      content and package fingerprint from the Git snapshot, never call generic
      remote content fetching, preserve local-directory routing, and derive
      legacy Gitea branch/directory metadata from source URLs.
- [x] `TEST-SU-017`: Regression tests for raw-only hosted Git recovery,
      encoded file URLs, local-source precedence under catalog collisions,
      same-inventory local snapshots, and extracted ZIP package snapshots.
- [x] `TEST-SU-018`: Regression tests proving authenticated Gitea clone
      descriptors retain transport credentials while review identities, Git
      failures, and AI safety prompts redact those credentials.
- [x] `TEST-SU-019`: Regression tests proving skills.sh entries without a
      verified directory omit guessed path metadata and nested repository
      packages are discovered, fingerprinted, snapshotted, and materialized by
      exact Skill identity.
- [x] `T-SU-029`: Carry a validated Skill selector through the complete Git
      package lifecycle, include it in fallback identity, and make duplicate
      repository discovery deterministic.
- [x] `TEST-SU-020`: Regression tests for lifecycle selector forwarding,
      same-repository identity separation, standard-container precedence,
      Unicode names, and unresolved ambiguity.
- [x] `TEST-SU-021`: Component regressions proving one header action opens a
      local/source comparison, keeping local is non-mutating, and accepting the
      source uses explicit overwrite only when required.
- [x] `T-SU-030`: Replace detail-header update/overwrite actions with the
      review-first check flow and reuse the Skill update comparison dialog.
- [x] `TEST-SU-022`: Add main-process snapshot, pure package-diff, store
      propagation, and component regressions for added, modified, removed,
      binary, oversized, and single-file-source cases.
- [x] `T-SU-031`: Carry validated package inventories through source checks and
      render a selectable complete package diff in the review dialog.
- [x] `TEST-SU-023`: Reproduce same-repository sibling selection, truncated
      skills.sh repository labels, discovered-directory metadata repair, and
      version-card UI.
- [x] `T-SU-032`: Guard installed-source recovery with exact Skill identity,
      return the validated Git package directory, repair canonical source
      metadata, reject truncated repository labels, and remove non-decision
      version cards from the review.

Progress note 2026-07-14 complete package review: validated local, Git, ZIP,
store, and Cloud snapshots now carry a bounded file inventory through the
source check. The review lists every added, modified, and removed file, renders
independent text diffs, and reports safe size/hash metadata for binary or
oversized files. Raw content URLs retain explicit `skill-md` scope so unrelated
local resources are not presented as deletions. Main snapshot, pure diff,
store propagation, and component regressions passed; desktop lint, typecheck,
build, and live Electron verification also passed.

Progress note 2026-07-14 review-first detail flow: the installed Skill detail
header now keeps one source-check action for every reconciliation state.
Actionable checks open the shared local/source comparison with explicit
keep-local and use-source decisions; only the use-source decision enters the
existing safety, staging, rollback, and baseline workflow, with overwrite
authorization limited to local-change and uncertain-baseline states. Component
regressions cover update-available, local-modified, conflict, baseline-missing,
high-risk review, linked-local blocking, and non-mutating cancellation.

Progress note 2026-07-14 skills.sh nested package follow-up: the catalog
adapter no longer assumes repositories named `skills` use `skills/<slug>`.
Remote package discovery is bounded, recursive, ignores generated directories,
and does not follow repository symlinks. Install and update-snapshot IPC share
the selector. The real `mattpocock/skills` repository resolved and materialized
`skills/productivity/grill-me`.

Progress note 2026-07-14 lifecycle selector audit: the validated selector now
crosses the shared operation contract, main-process lifecycle staging,
materialization, fingerprint snapshot, and fallback source identity. Discovery
supports Unicode frontmatter names and hidden Agent containers, prioritizes
standard Skill containers over unrelated examples, and rejects unresolved
same-priority ambiguity or an explicit selector that mismatches the only
package. Focused regressions, shared/core/desktop type checks, root lint,
desktop build, and the complete desktop unit suite passed.

Progress note 2026-07-07: added focused store regressions for source-unavailable sanitized error recording, remote package/content-url update persistence failure ordering, project/agent copied target stale auxiliary reporting, and detail-page status actions. Full end-to-end status integration coverage remains open under `TEST-SU-010`.

Progress note 2026-07-08: `TEST-SU-010` is closed. Added a store integration matrix covering `update-available`, `local-modified`, `conflict`, `baseline-missing`, `source-unavailable`, and stale target auxiliary reporting in one end-to-end source check path.

Progress note 2026-07-08: static audits are closed. Direct fingerprint writes now distinguish current local package (`directory_fingerprint`) from installed source baseline (`installed_directory_fingerprint`); SHA-256-labeled durable writes use the shared v1 package manifest utility; UI copy has distinct local-modified/conflict/baseline-missing/source-unavailable messages; source fetch/clone paths continue through the existing IPC validation, SSRF-protected fetcher, and repo path traversal guards.

Progress note 2026-07-08 review follow-up: added regressions for GitHub/Gitea tree scans not exposing legacy fingerprints, legacy algorithm migration/defaulting, content-url install baselines, and URL userinfo redaction.

Progress note 2026-07-09 regression follow-up: added ClawHub/MinerU update regressions proving store-backed and installed-source updates use the ClawHub package zip endpoint and never treat `https://clawhub.ai/<owner>/<skill>` as a Git repository URL.

Progress note 2026-07-14 private Gitea transport follow-up: Git-backed source
checks now obtain `SKILL.md` content and the complete package fingerprint from
one validated main-process clone snapshot. Private-network Gitea routes are
therefore handled by the explicit Git transport instead of the generic HTTP
content fetcher, while local directories remain local and generic HTTP SSRF
blocking remains unchanged. Added resolver, IPC, package snapshot, check,
install, update, and failure-path regressions.

Progress note 2026-07-14 transport audit follow-up: legacy raw-only Gitea and
GitHub file URLs now recover canonical Git metadata; concrete imported local
paths override colliding catalog identities; local and ZIP checks join Git in
using validated content/fingerprint package snapshots. Added real filesystem,
IPC validation, resolver, store routing, and extracted ZIP regressions.

Progress note 2026-07-14 credential-boundary follow-up: authenticated Gitea
repository URLs now remain intact only for cloning. Source review keys, Git
failure/timeout diagnostics, ZIP/Git safety inputs, and AI safety prompts use
credential-free URLs. Added resolver, adapter, process-error, and AI-prompt
regressions.

Progress note 2026-07-14 staging lifetime regression: the shared Git and ZIP
package wrappers now await snapshot reads, fingerprinting, safety scan, and
persistence before removing temporary clone/extraction directories. Deferred
snapshot and real archive tests prove checks, install, and blocked-package
review no longer race temporary cleanup.

## Static Audit Targets

- [x] Search for all direct uses of `directory_fingerprint` to ensure current versus baseline semantics are not conflated.
- [x] Search for all `computeStableTextHash` and `computeDirectoryFingerprint` uses and classify whether each should stay legacy or move to SHA-256.
- [x] Search for Skill update UI labels to ensure local-modified/conflict states do not share update-available copy.
- [x] Search for source fetch/clone paths to ensure proxy, SSRF, and path traversal policies remain enforced.

## Completion Criteria

- All new production branches and conditions have focused tests.
- Critical DB/filesystem/update paths have rollback tests.
- Active change `implementation.md` records actual verification and any skipped harness.
- Stable docs in `spec/knowledge/behavior/skills.md` and `spec/knowledge/reference/skill-regression-test-matrix.md` are updated after implementation.
