# Design

## DES-GATE-001: Lifecycle convergence

Only archive changes whose task lists have no unchecked items and whose
implementation status records completion. Release-pending mobile work remains
active. Regenerate the change index after all moves rather than editing it
manually.

## DES-GATE-002: Local path classifier and conditional jobs

`scripts/detect-ci-surfaces.mjs` is the single deterministic path map. It reads
newline-delimited paths from standard input and emits GitHub output pairs.
Root dependency and gate changes fan out to all surfaces. Shared changes fan
out to all consumers; core/database changes fan out to desktop and CLI. The
algorithm is one linear pass over changed paths, `O(n)` time and constant
surface state.

`quality.yml` always runs a small governance job. Product jobs depend on the
classifier and are skipped for unrelated documentation-only changes. Reusable
workspace setup lives in a local composite action so cache and install behavior
cannot drift between jobs.

## DES-GATE-003: Web and Worker boundary

The self-hosted web workflow remains the owner of web and Docker verification.
A separate path-filtered Worker workflow runs Worker lint, typecheck, and tests
without paying the unrelated web build and Docker cost on Worker-only changes.

## Failure And Capacity

- Changed paths come only from `git diff` and are passed over standard input,
  avoiding shell interpolation of filenames.
- Manual dispatch selects all surfaces.
- Jobs use existing package scripts and bounded GitHub-hosted runners.
- A classifier or governance failure fails the workflow rather than silently
  defaulting to a reduced gate.
