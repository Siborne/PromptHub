# Implementation

## Status

Completed and converged on 2026-07-10.

## Upstream Baseline

- Repository: `https://github.com/legeling/spec-init`
- Revision: `f83def11e7b3e1753cd6f32eacdf09b72b3b29ae`
- Revision date: 2026-06-30

## Shipped

- Synchronized the embedded generic skill to upstream revision `f83def1`;
  only `SKILL.md`, the PromptHub profile, and local tests intentionally differ.
- Added PromptHub's repository profile, phase topology, analyze/converge gates,
  archive and typed-record rules, and stronger local change templates.
- Added the seven stable verification surfaces while preserving the project's
  stricter existing testing rules as the enforceable source of truth.
- Added deterministic active/archive/legacy change inventory generation and a
  governance-debt issue for six missing delta specs and lifecycle candidates.

## Verification

- Red gate: `bash .agents/skills/spec-init/tests/spec-init-governance.sh`
  initially failed for the missing archive rules and inventory generator.
- Red gate: `bash .agents/skills/spec-init/tests/spec-change-index.sh` initially
  failed because the generator could not operate on a fixture root.
- Red gate: topology formatting validation exposed unquoted Markdown backticks
  that made the existing `spec-init.topology.yml` invalid YAML; notes are now
  quoted and the governance test parses the file through Prettier.
- `pnpm spec:test`: passed.
- Embedded upstream smoke suite using a temporary upstream checkout: passed.
- `quick_validate.py .agents/skills/spec-init`: `Skill is valid!`.
- `pnpm spec:index:check`: passed.
- `bash -n` for changed shell scripts, `node --check` for the inventory
  generator, and `git diff --check`: passed.

## Analyze

- Traceability is complete for `FR-SPECINIT-001` through `FR-SPECINIT-005`.
- No blocking conflict remains between upstream generic paths and PromptHub's
  authoritative `spec/*` topology; the repository profile owns the mapping.
- Historical record renames and ambiguous concurrent lifecycle moves were not
  performed and are tracked in `ISS-20260710-001`.

## Converge

- Stable workflow, rule, topology, README, issue, ADR, release, archive, and
  template surfaces are synchronized.
- `spec/changes/index.md` is current after moving this change to the dated
  archive.
- Final destination:
  `spec/changes/archive/2026/07/2026-07-10-spec-init-upstream-alignment/`.

## Residual Risk

- Historical change names and records remain compatible rather than being
  rewritten to the generic upstream ID scheme.
- Active changes with ambiguous completion/release state require a separate
  owner review before movement.
