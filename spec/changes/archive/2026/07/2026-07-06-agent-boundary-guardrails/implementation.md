# Implementation

## Shipped

- Updated `AGENTS.md` with an explicit Agent Operating Contract covering source-of-truth lookup, mandatory active-change gates, existing-feature modification, and new-feature addition.
- Replaced stale single-app architecture guidance with the current monorepo map for `apps/*`, `packages/*`, `spec/*`, and root harness scripts.
- Updated database, IPC, import, coverage, and storage rules to use current paths such as `packages/db`, `packages/core`, `packages/shared`, and `apps/desktop`.
- Added `spec/rules/agent-boundary-guardrails.md` as a stable rules entry for memoryless agents.
- Added `spec/rules/tdd-design-gate.md` as the general test-first and design-conflict stop rule.
- Added `spec/rules/code-quality-architecture.md` as the stable engineering quality rule for high cohesion, low coupling, dependency direction, source-of-truth ownership, rollback discipline, and file/function size limits.
- Updated `spec/rules/README.md` to reference the new guardrail and code-quality rules.
- Updated `spec/rules/testing-standards.md` and `spec/rules/definition-of-done.md` so bugfixes and non-trivial features require failing tests first, and design conflicts require user confirmation.
- Updated `.agents/skills/spec-init/SKILL.md` so repository-defined topology wins over the skill's generic `docs/` examples.
- Added `AGENTS.md` code-quality and architecture gates: source/test files must not exceed 2,000 lines, new files should stay under 1,000 lines by default, functions should stay under 50 lines by default, and existing over-limit files must not receive more behavior except during extraction.

## Verification

- Reviewed root `AGENTS.md`, project-local `spec-init` skill, and existing `spec/rules` files.
- Ran `rg` sanity checks for stale root instructions. Remaining `docs/*` references are confined to the generic `spec-init` skill examples and now have a project-topology override above them.
- No runtime tests were run because this change only updates documentation and agent instructions.

## Synced Docs

- `AGENTS.md`
- `.agents/skills/spec-init/SKILL.md`
- `spec/rules/agent-boundary-guardrails.md`
- `spec/rules/tdd-design-gate.md`
- `spec/rules/code-quality-architecture.md`
- `spec/rules/testing-standards.md`
- `spec/rules/definition-of-done.md`
- `spec/rules/README.md`

## Follow-ups

- Consider adding a lightweight `pnpm docs:check` script later to lint stale path references in `AGENTS.md` and `spec/rules`.
- Add a repository file-size check to CI/release harness so the 2,000-line rule is enforced mechanically.
