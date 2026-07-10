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

Progress note 2026-07-07: `T-SU-016` is closed for registry/source update checks through the shared `buildSkillSourceUpdateCheck()` reconciliation builder; sanitized source errors remain recorded at the renderer side-effect boundary. `T-SU-017` is still not complete enough to close. Implemented safe-apply slices include non-local remote source materialization before metadata baseline writes, staged safety preflight for remote package writes, and managed repo staging/backup swap on partial copy failure. `T-SU-022` is closed for durable DB writes; remaining DTO-only fingerprints intentionally do not carry the DB algorithm field.

Progress note 2026-07-07: `T-SU-020` is partially synced. Updated `spec/knowledge/behavior/skills.md` and `spec/knowledge/reference/skill-regression-test-matrix.md` for the implemented source update slices; leave the task open until resolver/downstream/final rollback scope is complete.

Progress note 2026-07-08: `T-SU-015` is closed. Added a renderer source resolver adapter boundary that classifies `remote-store`, `remote-git`, `remote-zip`, `content-url`, `local-linked`, and `managed-copy`; the store now uses that boundary for source checks. Raw `content-url` checks normalize the remote package fingerprint to the fetched `SKILL.md` content hash even when registry metadata carries a stale directory fingerprint.

Progress note 2026-07-08: `T-SU-020` is closed. Stable docs were advanced for the resolver layer, raw content-url safety/rollback behavior, and v1 package fingerprint algorithm semantics. Updated `spec/knowledge/behavior/skills.md`, `spec/knowledge/reference/skill-regression-test-matrix.md`, and `spec/knowledge/structure/skill-system-design.md`.

Progress note 2026-07-08: `T-SU-017` is closed. Remote Git/Zip sources stage and safety-scan before managed repo replacement; managed repo replacement uses staging/backup rollback; raw content-url updates safety-scan before writing `SKILL.md` and roll back through the version snapshot if the final DB baseline write fails.

Progress note 2026-07-08 review follow-up: external review found tree/API paths still deriving legacy blob-hash manifests as `directory_fingerprint`. Main and renderer registry tree loaders now leave package fingerprints empty unless a v1 package hash is available; content-url install baselines use the content hash; source error sanitization strips URL userinfo; DB migration marks existing directory fingerprints as `legacy-stable-text-v1`.

Progress note 2026-07-09 regression follow-up: ClawHub page URLs are not Git repositories. Installed ClawHub sources now derive `content_url` and `package_url` from the page slug, avoid Git package fingerprint checks, and do not reuse the installed local package fingerprint as the remote package fingerprint when the store entry is absent.

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

Progress note 2026-07-07: added focused store regressions for source-unavailable sanitized error recording, remote package/content-url update persistence failure ordering, project/agent copied target stale auxiliary reporting, and detail-page status actions. Full end-to-end status integration coverage remains open under `TEST-SU-010`.

Progress note 2026-07-08: `TEST-SU-010` is closed. Added a store integration matrix covering `update-available`, `local-modified`, `conflict`, `baseline-missing`, `source-unavailable`, and stale target auxiliary reporting in one end-to-end source check path.

Progress note 2026-07-08: static audits are closed. Direct fingerprint writes now distinguish current local package (`directory_fingerprint`) from installed source baseline (`installed_directory_fingerprint`); SHA-256-labeled durable writes use the shared v1 package manifest utility; UI copy has distinct local-modified/conflict/baseline-missing/source-unavailable messages; source fetch/clone paths continue through the existing IPC validation, SSRF-protected fetcher, and repo path traversal guards.

Progress note 2026-07-08 review follow-up: added regressions for GitHub/Gitea tree scans not exposing legacy fingerprints, legacy algorithm migration/defaulting, content-url install baselines, and URL userinfo redaction.

Progress note 2026-07-09 regression follow-up: added ClawHub/MinerU update regressions proving store-backed and installed-source updates use the ClawHub package zip endpoint and never treat `https://clawhub.ai/<owner>/<skill>` as a Git repository URL.

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
