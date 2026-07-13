# Implementation Record

## Status

- Phase: converge
- Status: released in `v0.5.9`; implementation, publication verification, and
  stable-document convergence are complete.

## Implemented Boundary

- Shared request, result, failure, source, review, and fingerprint contracts now
  describe every expected install/update outcome without raw token errors.
- The Desktop main process owns source resolution, complete-package staging,
  validation, safety classification, fingerprint-pinned approval, apply,
  rollback, startup cleanup, and in-flight operation coalescing.
- Remote Git, Zip, raw content, local directory, and Cloud adapters feed the
  same lifecycle. Invalid packages remain non-overridable, while reviewable
  high-risk findings remain typed and actionable.
- Store detail, quick install, batch install, Git/GitHub/Gitea import, Cloud
  install/update, and installed source update use shared renderer operation and
  review controllers. Review-required items are never counted as failures.
- Install applies only after authorization. Update snapshots and swaps the
  managed package before DB baseline finalization; compensation restores the
  previous durable state when an external boundary fails.
- My Skills update badges select candidates by exact source identity before
  compatible package fingerprints or version, preventing same-slug false
  updates.
- Staged `SKILL.md` frontmatter is the authoritative source for installed
  description, version, author, original tags, and compatibility. User-owned
  tags remain local, and the catalog `source` value is treated as a sentinel.
- Scanned Agent/project imports persist exact local-source identity, content
  hash, package baseline, installed version/time, and source binding. A later
  source change is checked and applied from that original directory.
- Managed legacy copies with `baseline-missing` can establish a baseline only
  through an explicit overwrite/reset action. Linked external directories keep
  the no-overwrite policy and return conversion guidance.
- A scanned copy import completes only after the full package and managed path
  are persisted. Copy/path failure removes the temporary row; incomplete
  compensation returns a chained rollback diagnostic.

## Verification

- `TEST-SIL-001` through `TEST-SIL-009`: passed for lifecycle result handling,
  Gitea review, fingerprint/trust behavior, DB/filesystem/IPC rollback,
  entry-point parity, concurrency, sanitized diagnostics, source adapters, and
  changed-condition coverage.
- `TEST-SIL-010`: passed for scanned-source baseline continuity, managed legacy
  reset, linked-local protection, copy/path persistence rollback, and incomplete
  compensation reporting.
- Focused critical Desktop lifecycle suite: 10 files, 132 tests passed.
- Imported-source lifecycle suite: 3 tests passed.
- Core package-operation suite: 18 tests passed with 100% statement, branch,
  function, and line coverage.
- Remote package adapter suite: 11 tests passed with 100% statement, branch,
  function, and line coverage.
- DB Skill versioning suite: 9 tests passed.
- Desktop i18n suite: 31 tests passed.
- Complete Desktop suite: 359 files, 3,115 tests passed.
- Shared, core, DB, and Desktop TypeScript checks passed.
- Desktop ESLint and repository file-size gate passed.
- Main critical coverage reached 100% statements/functions/lines and 99.42%
  branches. The only uncovered branch is V8's synthetic branch on the generic
  lifecycle cleanup `finally`; every new or changed decision and condition is
  covered.
- Website release sync, spec/index checks, and `git diff --check` passed.
- `pnpm verify:release:quick` completed shared/DB/core typechecks, CLI
  lint/typecheck/tests/build, and Desktop lint/typecheck, then was stopped during
  the Desktop unit stage by explicit maintainer instruction to publish through
  CI immediately. The full local release harness was not run; tag CI owns the
  final build, signing, notarization, artifact, and self-hosted Web gates.
- `v0.5.9` Desktop Build and Release run `29247235788` passed every platform,
  including signed/notarized macOS Intel and Apple Silicon artifacts. The
  self-hosted Web run `29247235722` passed and published the replacement GHCR
  image. The stable release contains 20 assets and was promoted on 2026-07-13.

## Analyze

- Traceability is complete for `FR-SIL-001` through `FR-SIL-012`.
- The implementation extends the archived source-update trust contract without
  changing the SQLite schema or the linked-local source-of-truth boundary.
- Source ownership is explicit: remote/scanned source identifies upstream,
  PromptHub managed repo owns copied My Skills content, and external directory
  owns linked-local content.
- No unresolved design conflict or `[待确认]` decision remains.

## Converge

- Stable Skill behavior and the regression matrix include canonical lifecycle,
  imported-source continuity, explicit managed baseline reset, linked-local
  protection, and scanned import compensation.
- The `0.5.9` changelog, website metadata, stable behavior, regression matrix,
  and release record include the final lifecycle fixes and publication proof.
- Final archive destination:
  `spec/changes/archive/2026/07/2026-07-13-skill-install-update-lifecycle-contract/`

## Product Flows Verified

- New Store/Git/Gitea/Cloud install: safe completion, actionable review,
  cancellation, blocked package, invalid package, and rollback.
- Installed source update: up to date, available, local modification, conflict,
  source unavailable, review, explicit overwrite, and rollback.
- External Agent/project import: copy and link ownership, later source change,
  legacy missing baseline, managed reset, and linked-local protection.
- Store status rendering: exact-source installed/update badges and same-slug
  collision handling.
