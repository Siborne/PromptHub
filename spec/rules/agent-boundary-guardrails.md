# Agent Boundary Guardrails

These rules make PromptHub's boundaries visible to memoryless AI agents.

## Mandatory Source Lookup

Before non-trivial implementation, agents must read:

- `AGENTS.md`
- relevant `spec/knowledge/*` docs
- relevant `spec/rules/*` docs
- matching `spec/changes/active/<change-key>/` records, if they exist
- current implementation and tests for the touched module

If a boundary exists, update that boundary. Do not create a parallel source of truth.

## Instruction Surface Boundary

PromptHub repository-wide instructions have one hierarchy:

1. `AGENTS.md`
2. `spec-init.topology.yml`
3. routed stable documents under `spec/*`
4. the matching active change for current deltas

Reusable procedures may live under `.agents/skills/*`, but a skill must point
back to the stable project source and cannot redefine it. Do not create
parallel project constraints under `.agents/rules/`, `.agents/workflows/`,
generic `docs/rules/`, or tool-specific files such as repository-local
`CLAUDE.md` and `.cursorrules`.

The embedded `spec-init` assets contain generic `docs/*` output templates for
other repositories. They are generator inputs, not PromptHub project rules.

## Existing Behavior Changes

Before changing existing behavior, identify and record:

- owning app/package
- source of truth for data
- current behavior contract
- existing tests and missing regression tests
- affected stable docs or active change

If code and docs disagree, record the discrepancy in the active change before choosing the new behavior.

## New Feature Changes

Before adding a new feature, define:

- data impact: SQLite, filesystem, settings, SKILL.md, remote payload, or UI-only state
- contract impact: IPC, route, CLI, shared type, preload API, or i18n
- ownership: `packages/core`, `packages/db`, `packages/shared`, or app-specific code
- migration and rollback behavior
- verification layer and release harness impact

## Data and Storage Changes

Any schema, migration, data layout, backup/restore, sync, or recovery change must use an active change folder and must document:

- fresh-install behavior
- existing-user migration behavior
- partial-failure behavior
- rollback/recovery behavior
- real SQLite or filesystem tests

Durable data rules:

- `packages/db` owns SQLite schema, migrations, adapter, and DB classes.
- `packages/core/src/runtime-paths.ts` owns user data directory decisions.
- `packages/shared` owns cross-package contracts.
- App packages own platform glue and UI orchestration only.

## Verification Discipline

Agents must choose the lowest effective verification layer and explain skipped checks. For release-sensitive work, `pnpm verify:release:quick` is the minimum local harness and `pnpm verify:release` is the release gate.

## Code Quality Discipline

Agents must preserve maintainable module boundaries while implementing changes:

- keep high cohesion and low coupling
- follow package/process dependency direction
- avoid adding behavior to files over 2,000 lines
- split oversized services, stores, components, and tests by responsibility
- keep durable business rules out of one-off UI components and IPC handlers
- record source-of-truth, rollback, and verification decisions for new data paths

Use `spec/rules/code-quality-architecture.md` as the detailed rule source.
