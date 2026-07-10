# Test Standards

## Canonical Rule

The enforceable test-code and coverage rules live in
`spec/rules/testing-standards.md` and `AGENTS.md`. This workflow document keeps
their project-level routing stable.

## Required Properties

- Test observable behavior and durable side effects, not implementation-only
  call counts.
- Reproduce the original failure for bug fixes.
- Prefer real adapters or faithful fixtures when mocks would bypass the risk.
- Cover happy path, boundary input, failure path, rollback, security, and
  performance according to the changed surface.
- Keep tests deterministic; do not use arbitrary sleeps, tautological mocks, or
  assertions that only prove a value exists.
- New branches and changed conditions require explicit coverage even when a
  legacy file cannot yet meet the whole-file target.

## Change Record Requirement

Each non-trivial active change records its selected test methods, commands,
results, skipped checks, and residual risk under `implementation.md`.
