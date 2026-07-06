# Proposal

## Why

The recent user-reported skill bugs show a TDD gap: the project has many skill tests, but several tests validate mocked calls or isolated UI labels rather than durable user-visible invariants. Bugs escaped around custom store import completeness, installed-state consistency, platform symlink cleanup, project distribution uninstall, safety scan source policy, store count consistency, and recursive file browsing.

The goal of this change is not to fix those bugs directly. The goal is to define the missing regression contracts and TDD gates so future fixes and features cannot ship with the same blind spots.

## Scope

- In scope:
  - Classify the ten reported skill bugs by missed invariant and missing test layer.
  - Add a stable skill regression test matrix.
  - Strengthen testing rules so skill tests must verify observable state, not only mocked calls.
  - Add active-change verification requirements for future bug fixes.
- Out of scope:
  - Implementing the product bug fixes.
  - Adding the actual test files in this change.
  - Redesigning the skill UI.

## Risks

- The matrix can become stale if it is not updated when the skill workflow changes.
- Some required tests are integration/E2E-level and may initially expose existing failures.

## Rollback Thinking

This is documentation and process hardening. Rollback is a simple revert of the added matrix/rule updates.
