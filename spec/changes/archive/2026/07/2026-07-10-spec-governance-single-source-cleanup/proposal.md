# Proposal: Consolidate Spec And Agent Governance Sources

## Why

PromptHub's canonical spec topology is now defined by `AGENTS.md`,
`spec-init.topology.yml`, and `spec/*`, but stale agent rules, a superseded
active change, and a duplicate delta-spec template can still direct agents
toward conflicting paths or workflows.

## Scope

- Remove the parallel `.agents/rules/` frontend and release instructions.
- Remove the duplicate `.agents/workflows/release-sync.md` workflow and keep
  `.agents/skills/release-sync/SKILL.md` as the single reusable release entry.
- Update the release skill to current monorepo paths and stable release gates.
- Archive the superseded `spec-structure-rename` change with an explicit
  convergence record.
- Remove the obsolete `example-domain` delta-spec template.
- Update governance debt and generated inventories.

## Non-Goals

- Change product behavior or release contents.
- Rewrite historical archived changes.
- Remove generic `docs/*` scaffold assets from the embedded `spec-init` skill.

## Rollback Thinking

The removed rule/workflow files are recoverable from Git history. The release
skill remains available and becomes the only reusable release procedure.
