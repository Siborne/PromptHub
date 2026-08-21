# Skill Package Canonical Finalization

## Status

Complete. The replacement `v0.6.0-beta.1` prerelease was published on
2026-08-21 after local, untagged candidate, tagged release, packaged startup,
platform signing, public asset, and container-isolation gates passed.

## Problem

In the published Beta, installing a Skill can fail with
`DATABASE_FINALIZE_FAILED` and the user-visible message that PromptHub cannot
save the Skill operation. The product remains readable, but the primary Skill
mutation workflow is unusable.

## Scope

- Reproduce the failure through the real Desktop package lifecycle while
  canonical file authority is active.
- Fix the owning persistence boundary rather than suppressing the structured
  failure.
- Preserve atomic rollback across SQLite rows, version history, canonical Skill
  bundles, managed repositories, and disposable workspaces.
- Add release regression coverage for a cold/reopened canonical runtime.

## Non-goals

- Redesign the Skill Store UI.
- Change Agent platform distribution behavior.
- Weaken package validation, safety scanning, or canonical publication checks.

## Risk And Rollback

The affected path spans filesystem publication and SQLite finalization. A fix
must leave no pending row, staged package, or partial canonical bundle after a
failure. Rollback is reverting this isolated change; existing canonical data
must remain readable by the prior Beta.
