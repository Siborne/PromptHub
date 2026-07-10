# Implementation

## Status

Completed and converged on 2026-07-10.

## Shipped

- Removed the parallel `.agents/rules/` and `.agents/workflows/` instruction
  surfaces, including the malformed always-on frontend rule.
- Consolidated release execution into `.agents/skills/release-sync/SKILL.md`,
  with current monorepo locale paths, stable release-policy lookup, website
  automation, and quick/full release gates.
- Added an explicit instruction-surface boundary to `AGENTS.md` and
  `spec/rules/agent-boundary-guardrails.md`.
- Removed the empty legacy `example-domain` delta-spec template.
- Marked `spec-structure-rename` superseded and archived it without rewriting
  its historical intermediate-topology record.
- Updated governance debt and the generated change inventory.

## Verification

- Red gate: `spec-governance-single-source.sh` initially failed on the
  always-on frontend rule, then on the obsolete template directory, then on the
  stale change inventory.
- `pnpm spec:test`: passed.
- `quick_validate.py .agents/skills/release-sync`: passed.
- `quick_validate.py .agents/skills/spec-init`: passed.
- Focused Prettier, shell syntax, inventory, and diff checks: passed.
- Whole-file Prettier continues to report the pre-existing root `AGENTS.md`
  style; the changed instruction block and all new/changed scoped artifacts pass
  whitespace and focused formatting checks without reformatting that legacy
  file wholesale.

## Analyze

- Only root `AGENTS.md` remains as a tracked tool instruction file.
- `.agents/` now contains plugin metadata and reusable skills, with no rule or
  workflow directory.
- Generic `docs/*` paths inside embedded `spec-init` assets remain generator
  templates and are explicitly excluded from PromptHub project governance.
- Historical release verification commands remain in release records as
  evidence; they are not current instruction sources.

## Converge

- Stable agent-boundary and release rules are synchronized.
- Governance debt no longer lists the archived topology change as active.
- Final destination:
  `spec/changes/archive/2026/07/2026-07-10-spec-governance-single-source-cleanup/`.
