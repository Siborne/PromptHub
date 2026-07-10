# Design

## Overview

Add `scripts/verify-release.mts` as the root release harness. The harness owns a flat list of checks, validates that no two entries share the same id or exact command, and runs the selected profile sequentially with fail-fast behavior.

Two profiles are available:

- `release`: full publishing gate, including integration, performance, bundle budget, and desktop E2E smoke.
- `quick`: faster local triage gate, limited to package typecheck, lint, unit tests, and builds.

## Affected Areas

- Data model: none.
- IPC / API: none.
- Filesystem / sync: none.
- UI / UX: none.
- Tooling:
  - Root `package.json` gains `verify:release` and `verify:release:quick`.
  - `packages/core`, `packages/db`, and `packages/shared` gain explicit `typecheck` scripts.
  - `packages/shared/tsconfig.json` now includes `utils/**/*` because utils are exported package surface.
  - `apps/desktop/vitest.config.ts` caps the desktop jsdom worker pool at two to four workers. This preserves isolated files while preventing the default CPU-wide pool from exhausting memory and starving Vitest RPC updates.

## Verification Layer Ownership

- Shared packages: compile exported shared contracts before downstream apps consume them.
- CLI: lint, typecheck, tests, and build for standalone distribution.
- CLI workspace snapshot tests retain full filesystem, SQLite, MCP, and Plugin assertions while using a 15-second per-test budget so a timed-out async test cannot reset shared runtime paths during the following case.
- Heavy desktop jsdom regressions use the established 30-second desktop test budget instead of narrower local overrides that fail only under full-suite load.
- Desktop unit tests run with two to four workers. The worker bound is a release-test reliability control, not a relaxation of assertions or individual test budgets.
- Desktop integration mocks must expose the renderer database exports used by the backup flow. Prompt-card integration tests assert the semantic role, focusability, and keyboard behavior actually provided by the card rather than a `type` attribute unavailable on its composite control.
- Desktop: lint, typecheck, unit, integration, build, performance budget, bundle budget, and E2E smoke.
- Web: lint, typecheck, tests, and build.
- Cloudflare worker: lint, typecheck, and tests.

## `DES-VERIFY-003`: Desktop Verification Reliability

Desktop unit verification uses a bounded worker pool to avoid RPC starvation
under full-suite load. The full release profile must also use the renderer
database contract currently consumed by backup export and assert prompt-card
keyboard semantics through the composite control's observable role,
focusability, and activation behavior. Test fixtures must not preserve obsolete
exports or DOM element assumptions.

## Tradeoffs

- The harness intentionally does not call aggregate scripts such as `test:release` or `verify:web`; it expands the underlying unique commands so duplicate validation is visible and prevented.
- Checks are sequential for readable failure logs and deterministic stop points. Parallel execution can be added later after the first stable gate is trusted.

## Traceability

| Requirement | Design | Verification | Task |
| --- | --- | --- | --- |
| `FR-VERIFY-003` | `DES-VERIFY-003` | `TEST-VERIFY-003`, `TEST-VERIFY-004` | `T-VERIFY-003` |
