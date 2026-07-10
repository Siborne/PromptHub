# Design: Governance Source Consolidation

## `DES-GOV-001`: Remove parallel project rules

Delete `.agents/rules/frontend.md` and `.agents/rules/release-sync.md`.
Frontend behavior remains governed by `AGENTS.md`; release behavior remains in
stable release docs plus the reusable release skill.

## `DES-GOV-002`: Keep one release skill

Delete `.agents/workflows/release-sync.md`. Update
`.agents/skills/release-sync/SKILL.md` to read `AGENTS.md` and
`spec/releases/release-rules.md`, use `apps/desktop` locale paths, and select
`pnpm verify:release:quick` or `pnpm verify:release` according to release risk.

## `DES-GOV-003`: Remove the empty legacy template

Keep `specs/domain/spec.md` and delete `specs/example-domain/spec.md`.

## `DES-GOV-004`: Archive the replaced topology change

Record that `spec-structure-rename` was superseded by the current
`workflow/knowledge/changes/records` topology, then move it intact to the dated
archive. Do not retrofit a fake delta spec into historical work.

## Analyze Result

- User confirmation resolves the design conflict between the stale active
  change and current stable topology.
- Generic `spec-init` scaffold assets are output templates, not PromptHub
  project constraints, and remain unchanged.
- `CONTRIBUTING.md`, `docs/contributing.md`, and README references already
  route to the canonical spec hierarchy.
