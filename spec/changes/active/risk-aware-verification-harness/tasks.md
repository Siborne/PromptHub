# Tasks

## Design And Baseline

- [x] `T-HARNESS-000` Inspect the current root runner, package scripts, CI
      workflows, surface detector, stable verification docs, and archived
      first-generation harness change.
- [x] Define requirements, architecture, failure semantics, resource ownership,
      performance constraints, and the complete traceability chain.
- [ ] `T-HARNESS-001` Record three cold and three warm pre-change runs for
      changed-equivalent, quick, and release inventories, including per-check
      duration and duplicate build/migration counts
      (`NFR-HARNESS-003`, `TEST-HARNESS-017`).

## Registry And Selection

- [x] `T-HARNESS-002` Add the typed registry modules and keep
      `scripts/verify-release.mts` as the stable compatibility entry
      (`FR-HARNESS-001`, `TEST-HARNESS-001`).
- [x] `T-HARNESS-003` Add registry validation for ids, exact commands,
      dependencies, cycles, profiles, timeouts, resource groups, and required
      layers (`FR-HARNESS-001`, `TEST-HARNESS-002`).
- [x] `T-HARNESS-004` Implement the shared surface graph, safe changed-path
      selection, dependency closure, and compatibility wrapper for
      `detect-ci-surfaces.mjs`
      (`FR-HARNESS-002`, `TEST-HARNESS-003`, `TEST-HARNESS-004`).

## Complete Risk Inventory

- [x] `T-HARNESS-005` Register changed, quick, release, and platform package
      profiles while preserving the existing public command names
      (`FR-HARNESS-003`, `TEST-HARNESS-005`).
- [x] `T-HARNESS-006` Add omitted governance, shared/core tests, database,
      mobile, Web smoke, Worker build-proof, and applicable packaging entries
      (`FR-HARNESS-003`, `TEST-HARNESS-006`).
- [x] `T-HARNESS-007` Add the cross-boundary contract check ownership pattern
      and initial producer/consumer runtime-schema round-trip fixture
      (`FR-HARNESS-004`, `TEST-HARNESS-007`, `TEST-HARNESS-008`).

## Execution And Reporting

- [x] `T-HARNESS-008` Implement bounded topological execution, serial resource
      groups, timeouts, signal handling, and task-owned process cleanup
      (`FR-HARNESS-005`, `NFR-HARNESS-002`,
      `TEST-HARNESS-009` through `TEST-HARNESS-011`).
- [x] `T-HARNESS-009` Add deterministic terminal summaries, bounded optional
      JSON reports, redaction, and explicit-report failure handling
      (`FR-HARNESS-006`, `NFR-HARNESS-002`,
      `TEST-HARNESS-012`, `TEST-HARNESS-016`).
- [x] `T-HARNESS-010` Split build-first developer commands from built-artifact
      smoke commands and prove each selected artifact builds once
      (`FR-HARNESS-007`, `TEST-HARNESS-014`).

## Governance And Performance

- [x] `T-HARNESS-011` Add selection scale, cycle, malformed path, duplicate,
      and unknown-path fallback tests
      (`NFR-HARNESS-001`, `TEST-HARNESS-015`).
- [ ] `T-HARNESS-012` Add the closed SQLite template-fixture helper to eligible
      suites, preserve fresh-database migration tests, and record the complete
      post-change cold/warm measurement matrix
      (`NFR-HARNESS-003`, `TEST-HARNESS-017`).
- [x] Fixture implementation and isolation/recovery regression coverage are
      complete.
- [ ] The complete cold/warm measurement matrix remains a release gate.
- [x] `T-HARNESS-013` Move CI to registry-derived selection and commands, keep
      platform packaging non-publishing, and verify compatibility entry points
      (`NFR-HARNESS-004`, `TEST-HARNESS-018`).
- [x] `T-HARNESS-014` Add active-change traceability validation and its
      malformed-fixture tests
      (`FR-HARNESS-006`, `TEST-HARNESS-013`).

## Convergence

- [x] Run focused harness unit and integration tests.
- [x] Run `pnpm spec:test` and `pnpm spec:index:check`.
- [x] Run file-size validation and record the two pre-existing 1,536-line
      failures; the gate remains a convergence blocker.
- [ ] Run the new quick profile three times and confirm the median improvement
      without a risk-layer reduction.
- [ ] Run the complete release profile and the applicable platform package
      profile in CI.
- [x] Update `implementation.md` with actual commands, durations, resource
      observations, skipped checks, and residual risks.
- [x] Sync stable verification, testing, CI, and fixture documentation.
- [ ] Complete converge analysis and archive the change only after all required
      checks pass.

## Verification Inventory

- `TEST-HARNESS-001`: compatibility entry and registry list expose the expected
  stable quick/release checks.
- `TEST-HARNESS-002`: duplicates, cycles, unknown dependencies, missing
  timeouts, invalid profiles, and missing required layers fail before spawn.
- `TEST-HARNESS-003`: representative root/shared/db/core/app paths select the
  expected transitive surfaces.
- `TEST-HARNESS-004`: unknown, malformed, and unavailable diff inputs fail safe
  without command injection.
- `TEST-HARNESS-005`: each profile selects exactly its documented risk layers
  and dependency closure.
- `TEST-HARNESS-006`: every maintained surface has its required inventory,
  including shared/core tests, mobile, governance, and Web smoke.
- `TEST-HARNESS-007`: a real producer payload is accepted by the current
  consumer runtime validator.
- `TEST-HARNESS-008`: an intentionally stale consumer enum fixture fails the
  contract check.
- `TEST-HARNESS-009`: dependency order, blocked dependants, and independent
  bounded concurrency are observable with real child fixtures.
- `TEST-HARNESS-010`: resource-group checks never overlap and concurrency never
  exceeds the configured limit.
- `TEST-HARNESS-011`: timeout and interruption terminate only task-owned child
  process groups and leave no listener or child alive.
- `TEST-HARNESS-012`: terminal and JSON results have deterministic status,
  duration, dependency, and failure classification.
- `TEST-HARNESS-013`: malformed active-change traceability is rejected and a
  complete chain passes.
- `TEST-HARNESS-014`: desktop and Web smoke consume previously built artifacts
  and the build count is one.
- `TEST-HARNESS-015`: selection remains within the measured budget for 10,000
  changed paths and the bounded registry inventory.
- `TEST-HARNESS-016`: reports are bounded and redact representative secrets and
  environment values.
- `TEST-HARNESS-017`: template-backed normal tests remain isolated while
  migration/recovery tests use fresh databases; measured quick median improves
  by at least 30%.
- `TEST-HARNESS-018`: local and CI list the same check ids; platform package
  checks build without publishing or requiring release credentials.
