# Test Strategy And Quality Gates

## Purpose

This file defines the stable project-level test strategy. Detailed assertions,
coverage rules, and change-specific commands remain in
`spec/rules/testing-standards.md` and active change records.

## Risk-Based Layers

| Layer                | Primary risk                                                           | PromptHub baseline                            |
| -------------------- | ---------------------------------------------------------------------- | --------------------------------------------- |
| White-box unit       | incorrect branches, guards, normalization, derivation                  | required for changed logic                    |
| Integration/contract | DB, filesystem, IPC/preload, CLI/API, sync boundaries                  | required when mocks can hide the failure      |
| UI behavior          | inaccessible, unresponsive, or inconsistent user workflow              | component test plus real interaction evidence |
| E2E smoke            | cross-process or browser workflow failure                              | required for critical delivery paths          |
| Security/adversarial | traversal, symlink, injection, secret leakage, tampering               | required for affected trust boundaries        |
| Performance/stress   | large inventories, bulk actions, repeated mutation, memory/time growth | required when scale-sensitive paths change    |
| Release/packaging    | missing export, bundle, installer, manifest, or platform artifact      | root release harness                          |

## Exit Gates

- Every changed requirement has a verification ID and executable evidence.
- Every changed condition, fallback, and error boundary has a test or a
  recorded reason and substitute.
- UI-visible changes include actual interaction steps and observations.
- Persistence and filesystem changes include failure/rollback evidence.
- Release candidates run `pnpm verify:release`; quick verification is a local
  diagnostic profile, not release approval.
- Registry validation, affected-surface selection, timeout/process cleanup, and
  bounded reporting are themselves executable harness tests.
- CI selects the same registry check ids as local commands; workflow YAML must
  not copy package command inventories.
- Failures, skipped checks, warnings, and residual risks are recorded in the
  active change implementation.
