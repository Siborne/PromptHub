# PromptHub 0.6.0-beta.1 Readiness

## Phase And Status

- Phase: implement
- Status: ci-repair
- Primary requirement: `FR-BETA1-001`

## Why

The `0.6.0` line contains substantial unreleased Desktop, CLI, Web, Worker,
Mobile, storage, Agent, MCP, Rule, and Plugin work. A preview release is needed
before stable promotion, but the current workspace still reports the stable
build version and fails the repository release gate.

## Scope

- Prepare the shipped distributions as `0.6.0-beta.1` without changing the
  latest-stable download contract.
- Fix deterministic release-gate failures in file-size, performance, Worker,
  CLI, and Desktop test surfaces.
- Run the quick and full release verification profiles before any tag is
  created.
- Record remaining artifact, signing, notarization, and publication work.

## Out Of Scope

- Publishing a package, container, mirror, or app-store build outside the
  tag-triggered GitHub Release workflow.
- Promoting `0.6.0` to the stable channel.
- Completing unrelated designed-but-unimplemented active changes.

## Risks And Rollback

- The shared worktree contains many unreleased changes. Release preparation
  must not discard or overwrite any of them.
- Test-budget fixes must improve or correctly isolate work rather than merely
  weakening budgets.
- Before publication, rollback is limited to restoring version-bearing files
  and prerelease documentation. No user-data migration is introduced here.
- The first tag-triggered run failed before packaging. The beta tag may be
  moved to the CI-repair commit only while no public release exists.
