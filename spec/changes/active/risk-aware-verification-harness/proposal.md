# Proposal

## Status

Design complete; implementation has not started.

## Why

The first root release harness established a useful flat command inventory, but
it remains a sequential command aggregator rather than a risk-aware verification
system. Local release verification, pull-request workflows, package scripts,
and domain regression matrices can drift independently.

The current drift is observable:

- the root harness typechecks `packages/shared` and `packages/core` but does not
  run their test scripts, while the Quality Checks workflow does;
- the root harness does not include the maintained mobile surface;
- self-hosted Web and Cloudflare Worker verification are split between the root
  harness and separate workflows without one shared surface graph;
- contract, governance, coverage, packaging, and smoke checks are not modeled as
  explicit risk layers;
- E2E commands can rebuild artifacts already produced by an earlier harness
  check;
- checks have no per-check timeout, resource group, dependency graph, or
  machine-readable result.

This allows a change to pass all selected package suites while still breaking a
cross-surface contract or a second user-visible action entry point.

## Outcome

PromptHub will have one typed verification registry used by local commands and
CI. The registry will select checks from changed paths and dependency fan-out,
run independent work with bounded concurrency, serialize conflicting resources,
enforce timeouts and cleanup, and expose explicit contract, integration,
performance, E2E, and packaging gates.

## In Scope

- Replace the hard-coded flat check array with a typed check registry and
  dependency-aware runner.
- Define one surface dependency graph for governance, shared packages, database,
  core, CLI, desktop, self-hosted Web, Cloudflare Worker, and mobile.
- Add `changed`, `quick`, `release`, and platform `package` profiles.
- Bring currently omitted maintained package tests and governance checks into
  the root registry.
- Add an explicit cross-boundary contract layer.
- Reuse build artifacts instead of rebuilding them in dependent smoke checks.
- Add per-check timeout, bounded concurrency, resource groups, process cleanup,
  deterministic summaries, and optional JSON reports.
- Make CI call the same registry instead of duplicating command lists.
- Establish a migrated SQLite template-fixture contract for suites whose normal
  cases do not need to exercise migration itself.
- Add executable validation for active-change traceability.
- Install Playwright's official repository-scoped Codex test-agent definitions
  for planning, generating, and diagnosing desktop E2E tests.
- Adapt the generated MCP command and seed test to the desktop package without
  creating a competing root `specs/` document tree or changing global Codex
  configuration.

## Out of Scope

- Fixing product issues #190 through #193 inside this tooling change.
- Replacing product-specific regression tests with generic harness tests.
- Uploading or publishing release artifacts from the harness.
- Adding a remote build cache or a persistent local test-result cache.
- Running macOS, Windows, and Linux installers from one local machine.
- Rewriting all existing tests or moving tests between owners without a
  demonstrated boundary problem.
- Treating AI-generated tests or healer edits as release evidence before the
  resulting deterministic Playwright test passes the normal harness.
- Granting the test agents permission to modify production code, weaken
  assertions, skip failures, publish artifacts, or use a real user profile.

## Success Measures

- Local and CI verification use the same check ids and surface graph.
- A shared, database, or core change fans out to every affected maintained
  consumer; an unknown path or unavailable diff fails safe to the full selected
  profile.
- `packages/shared` and `packages/core` tests, mobile verification, governance,
  and the self-hosted Web smoke layer cannot silently disappear from the release
  inventory.
- Every check has a finite timeout and every started process is stopped or
  awaited before the runner exits.
- No profile executes the same logical command or build artifact twice.
- Cross-surface runtime contract changes have an executable round-trip gate.
- Three-run warm and cold baselines are recorded before performance budgets are
  locked. The implementation must reduce the current quick-profile median by at
  least 30% without reducing selected risk coverage.

## Risks

- Path-aware selection can create false negatives if the surface graph is
  incomplete. Unknown paths therefore select all surfaces for the requested
  profile.
- Parallel execution can increase peak memory or expose process-global test
  state. Concurrency is bounded and checks with shared SQLite, Electron, port,
  or process-global state use explicit serial resource groups.
- Tight timeouts can create flaky failures. Initial budgets are based on three
  measured runs and include a documented margin rather than copying arbitrary
  per-test timeouts.
- Moving CI to a shared registry can temporarily expose command drift or tests
  that only passed in one workflow environment.

## Rollback

The existing `pnpm verify:release` and `pnpm verify:release:quick` command names
remain stable. During migration, the previous runner remains available behind a
temporary internal compatibility entry. If selection or execution proves
unreliable, CI can call the compatibility entry while the registry is repaired.
Product code and persistent user data are unaffected.
