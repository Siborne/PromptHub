# Skill Module Boundary Refactor

## Why

The Skill update change touched several legacy files that already exceed the project 2,000-line hard limit. Adding behavior directly to those files violates the code-quality gate and makes source-update, safety, settings, and UI responsibilities harder to verify independently.

## Scope

- Extract remote package safety policy from the `SkillInstaller` facade.
- Extract source-update orchestration and review UI from the Skill Zustand store and full detail page along domain boundaries.
- Move the new real-user regressions into focused test suites instead of growing the legacy 4,000-line store test.
- Define and complete the migration map for Skill store, settings store, and
  detail-page responsibilities.
- Add an automated line-count gate so touched/new source and test files cannot silently exceed 2,000 lines.

## Non-Goals

- Move code into arbitrary files only to reduce line counts.
- Change Skill data ownership, update semantics, IPC contracts, or persisted settings behavior.
- Rewrite all Skill UI or Zustand state in one unreviewable change.

## Compatibility

This is a behavior-preserving structural refactor. Existing public store actions, preload APIs, IPC channels, settings keys, and user workflows remain stable.

## Rollback

Each extraction remains independently reversible because contracts and behavior do not change. The line-count gate can be temporarily scoped to changed files if unrelated legacy debt blocks repository-wide enforcement.
