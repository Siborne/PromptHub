# Tasks

## Governance And TDD Gate

- [x] `T-SIL-000`: Record the escaped Gitea install failure, current ownership,
      source of truth, design options, and `FR -> DES -> TEST -> T` mapping.
- [x] Complete Analyze: no orphan IDs, no conflict with the archived
      update-review design, and no blocking `[待确认]` item.
- [x] `T-SIL-001`: Add the failing first-install Gitea regression before
      production implementation. Covers `FR-SIL-003` and `FR-SIL-010`.

## Implementation Sequence

- [x] `T-SIL-002`: Add shared operation request/result/failure contracts and
      pure lifecycle policy with exhaustive result handling. Covers `FR-SIL-001`,
      `FR-SIL-002`.
- [x] `T-SIL-003`: Implement the main-process lifecycle service, validated IPC,
      in-flight identity, source adapters, and staging cleanup. Covers
      `FR-SIL-001`, `FR-SIL-005`, `FR-SIL-008`, `FR-SIL-009`.
- [x] `T-SIL-004`: Move first install to stage/scan/review before durable row
      creation; support fingerprint approval and exact-source trust retry. Covers
      `FR-SIL-003`, `FR-SIL-004`.
- [x] `T-SIL-005`: Migrate installed update to the lifecycle service while
      retaining conflict, snapshot, atomic swap, and rollback behavior. Covers
      `FR-SIL-005`, `FR-SIL-009`.
- [x] `T-SIL-006`: Add one renderer controller and shared review dialog for
      install/update. Migrate Store detail and installed Skill detail. Covers
      `FR-SIL-004`, `FR-SIL-006`.
- [x] `T-SIL-007`: Migrate quick install, batch install, and Git repository
      import; add review queues and structured summaries. Covers `FR-SIL-006`.
- [x] `T-SIL-008`: Add stable error codes, sanitization, i18n, diagnostics, and
      nonterminal review reporting. Covers `FR-SIL-002`, `FR-SIL-007`.
- [x] `T-SIL-009`: Complete focused coverage, filesystem/DB/IPC integration,
      security, concurrency, component regression, and release harness. Covers
      `FR-SIL-008`, `FR-SIL-010`.
- [x] `T-SIL-010`: Converge stable Skill behavior, regression matrix, issue and
      release records; archive the change only after implementation and release
      verification agree.

## Completed Implementation

- [x] Replace the first-install `Skill | null` result with a discriminated
      `installed` / `safety-review-required` result and preserve the complete
      authoritative review object through the renderer store.
- [x] Add shared install and batch-update review controllers with
      fingerprint-pinned approval, changed-package re-review, duplicate-confirm
      guards, and trust persistence only after successful completion.
- [x] Route Store detail, Store quick install, batch install, batch update, and
      Git/GitHub/Gitea import through actionable review dialogs or review queues.
- [x] Make review-required Cloud installs nonterminal and keep them out of the
      generic install-failure path.
- [x] Return review for high-risk raw content URL updates instead of treating a
      reviewable package as non-overridable.
- [x] Fail with `ROLLBACK_INCOMPLETE` when a temporary first-install row cannot
      be removed; never offer an approval retry against an uncertain durable
      state.
- [x] Split Store presentation, filters, overlays, and operation controllers so
      changed source files remain below the preferred 1,500-line boundary.
- [x] Add the escaped Gitea UI regression, store rollback/fingerprint tests,
      controller trust tests, content-URL review coverage, and real temporary
      Git repository integration coverage.
- [x] Replace the My Skills slug-keyed update badge lookup with a pure
      exact-source selector; cover same-slug collisions, legacy ambiguity,
      fingerprint compatibility, and the rendered no-false-badge state.
- [x] Add the main-process stage/scan/apply lifecycle, startup staging cleanup,
      in-flight operation coalescing, source adapters, atomic managed-repo swap,
      DB finalization, and compensation for install and update.
- [x] Persist exact source identity and content/package baselines when importing
      scanned Agent/project Skills, and allow explicit baseline establishment
      for managed legacy copies without weakening linked-local protection.
- [x] Treat scanned copy import as successful only after package and managed
      path persistence; remove the temporary row on failure and report chained
      rollback diagnostics if compensation is incomplete.
- [x] Derive installed metadata from the authoritative staged `SKILL.md`, while
      retaining user-owned tags and treating catalog `source` as a sentinel
      rather than a persisted version.

## Verification Matrix

| Verification   | Required proof                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| `TEST-SIL-001` | Shared lifecycle result decision table is exhaustive; expected outcomes are never stringified exceptions       |
| `TEST-SIL-002` | Reported Gitea first install returns review UI and succeeds after exact fingerprint approval                   |
| `TEST-SIL-003` | Changed fingerprint re-reviews; exact-source trust retries only after scanning; blocked remains blocked        |
| `TEST-SIL-004` | Install/update DB and filesystem failures roll back completely; crash cleanup removes abandoned staging        |
| `TEST-SIL-005` | Store detail, quick, batch, Git import, and installed update show equivalent outcomes                          |
| `TEST-SIL-006` | Duplicate clicks and concurrent operations cannot create duplicate rows, versions, or repos                    |
| `TEST-SIL-007` | Stable failure codes and sanitized diagnostics never expose credentials or raw internal review tokens          |
| `TEST-SIL-008` | Git, Zip, content URL, local directory, Cloud, and linked-local adapters retain their security/ownership rules |
| `TEST-SIL-009` | Touched production branches/conditions meet coverage gate and release harness passes                           |
| `TEST-SIL-010` | Scanned local imports preserve source/baseline continuity; copy/path failures roll back without false success |

## Exact File Inventory

| Area               | Files to add or change                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shared contract    | `packages/shared/types/skill.ts`, shared type exports/tests                                                                                      |
| Core policy        | `packages/core/src/skills/package-operation.ts`, core unit tests                                                                                 |
| Main lifecycle     | `apps/desktop/src/main/services/skill-package-lifecycle.ts`, `skill-installer*.ts`, `skill-update-safety.ts`                                     |
| IPC/preload        | `apps/desktop/src/main/ipc/skill/package-operation-handlers.ts`, IPC registration, `apps/desktop/src/preload/api/skill.ts`, shared IPC constants |
| Renderer store     | `apps/desktop/src/renderer/stores/skill/skill-store-types.ts`, `skill-registry-actions.ts`, source update modules                                |
| Shared UI          | new lifecycle controller/review dialog, `SkillStoreDetail.tsx`, installed Skill detail                                                           |
| Other entry points | `SkillStore.tsx`, `useCreateSkillGithubImport.ts`, batch install helpers                                                                         |
| Verification       | main integration, store, component, IPC, safety, concurrency, rollback, and Gitea fixtures under `apps/desktop/tests/`                           |
| Convergence        | `spec/knowledge/behavior/skills.md`, `spec/knowledge/reference/skill-regression-test-matrix.md`, issue/release records, change index             |

## Required Commands

- Focused failing test first, then focused implementation suites.
- `pnpm --filter @prompthub/desktop typecheck`
- `pnpm --filter @prompthub/desktop lint`
- `pnpm lint:file-size`
- Touched-module coverage with 100% changed branch/condition coverage.
- `pnpm verify:release:quick`
- `pnpm verify:release`
- `pnpm spec:test`
- `pnpm spec:index:check`
- `git diff --check`

## Current Evidence

- The new first-install regression failed first because
  `SAFETY_REVIEW_REQUIRED` was thrown as a generic error, then passed after the
  structured-result implementation.
- Focused critical lifecycle coverage passes 132 tests across 10 Desktop test
  files; imported-source continuity passes 3 tests; core package-operation
  passes 18 tests; DB versioning passes 9 tests.
- The complete Desktop suite passes 359 files and 3,115 tests.
- Core package-operation and remote package adapter suites reach 100% statement,
  branch, function, and line coverage. All new and changed library import,
  rollback, baseline-reset, and invalid-package conditions are exercised.
- Shared, core, DB, and Desktop TypeScript checks pass, Desktop ESLint passes,
  and the repository file-size gate passes. No touched source or test file
  exceeds 2,000 lines; new files remain below 1,000 lines.
- Website sync, spec/index checks, and diff checks pass. The quick harness
  completed its first nine stages through Desktop typecheck, then was stopped
  during Desktop unit tests by explicit maintainer instruction; the full local
  harness is intentionally skipped and tag CI is the publication gate.
- The `v0.5.9` Desktop and self-hosted Web tag workflows passed, the stable
  release was promoted with 20 assets, and Homebrew/GHCR were refreshed.
- The active change is ready for convergence and archive after those final
  release gates pass.
