# Skill Install And Update Lifecycle Contract

## Phase And Status

- Phase: implement
- Status: Desktop review-flow slice implemented; main-process lifecycle
  consolidation remains active
- Primary requirements: `FR-SIL-001` through `FR-SIL-010`
- Exit condition: every Desktop Skill install/update entry point consumes one
  structured lifecycle contract, reviewable findings never degrade into raw
  error strings, and release-level regression verification passes.

## Why

A self-hosted Gitea Skill can pass the catalog or `SKILL.md` preview, then be
classified as `high-risk` when the complete staged package is scanned. The
main/preload boundary correctly returns `safety-review-required`, but the first
install store action catches that domain result, replaces it with a plain
`Error("SAFETY_REVIEW_REQUIRED")`, rolls back the temporary install, and leaves
the user with no review or approval action.

The installed-Skill update path already has structured review support. The
first-install path, quick install, batch install, and Git repository import do
not share that result contract. This is a lifecycle design defect rather than
one missing toast: expected states are represented as typed outcomes in one
path and exceptions in another.

## User Outcome

- Install and update use the same source resolution, staging, safety,
  fingerprint approval, trust, apply, and rollback rules.
- `high-risk` always opens an actionable review with findings; it is not shown
  as a failed installation.
- `blocked` and structural violations remain non-overridable.
- Safe, reviewed, cancelled, conflicted, and failed operations have distinct
  visible outcomes at every entry point.
- No install/update path can flatten a known domain outcome into a raw error
  message.

## Scope

### In scope

- Desktop built-in/custom Store detail installation and update.
- Store quick install and batch install.
- Git/GitHub/Gitea repository scan and selected-Skill import.
- Remote Git, remote Zip, raw content URL, local directory, and Cloud package
  adapters used by those entry points.
- Shared operation contracts, main-process orchestration, preload exposure,
  renderer controller, review UI, error codes, rollback, and regression tests.
- Existing exact-source trust and fingerprint-pinned approval behavior.

### Out of scope

- Automatic three-way content merge for locally modified Skills.
- Host-wide trust or bypassing `blocked`, path traversal, invalid package, or
  unsafe archive findings.
- Background unattended installation of review-required packages.
- Changing the Agent/project distribution contract after a Skill has been
  installed or updated.
- Publishing or release tagging in this change.

## Architecture Decision

Choose a main-process-owned lifecycle orchestrator, backed by shared contracts
and a pure policy/state module. Do not patch each React surface independently.
The main process is the only layer that can consistently coordinate staging,
filesystem replacement, SQLite mutation, version snapshots, and rollback.

Renderer stores and components become consumers of typed outcomes. They may
own transient dialog state and the persisted exact-source trust list, but they
must not implement a second install/update state machine.

## Risks

- Changing `installRegistrySkill` from `Skill | null` to a discriminated result
  affects many tests and all install callers; partial migration would recreate
  the same bug.
- Moving durable orchestration out of renderer store actions can expose hidden
  assumptions in Cloud, local-directory, and content-URL adapters.
- Filesystem and SQLite cannot share one native transaction, so compensation
  and crash cleanup must be explicit and tested.
- Quick and batch install require review queuing instead of silently treating
  review-required as failure.

## Rollback Thinking

- No database migration is planned; existing Skill rows and baseline fields
  remain compatible.
- Keep low-level remote package staging helpers until every product caller has
  migrated, then make them internal rather than deleting them during the first
  implementation step.
- If the lifecycle migration must be reverted, restore the previous callers as
  one unit. Do not retain a mixed state where only some entry points understand
  structured outcomes.
- Temporary staging directories must be removed on success, review-required,
  cancellation, failure, and next-start cleanup.

## Related Records

- Prior update-only change:
  `spec/changes/archive/2026/07/2026-07-11-skill-source-update-trust-review/`
- Stable behavior: `spec/knowledge/behavior/skills.md`
- Regression matrix: `spec/knowledge/reference/skill-regression-test-matrix.md`
- Root cause:
  `apps/desktop/src/renderer/stores/skill/skill-registry-actions.ts`
