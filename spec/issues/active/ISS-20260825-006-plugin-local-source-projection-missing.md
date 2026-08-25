# Canonical Plugin Loses Its Local Update Source

## Record

- ID: `ISS-20260825-006`
- Status: design_confirmation_required
- Severity: high Plugin update blocker
- Owning change: `spec/changes/active/agent-management-workbench/`
- First local triage: 2026-08-25
- Automated evidence:
  `apps/desktop/tests/e2e/agent-plugin-lifecycle.spec.ts`

## Confirmed Phenomenon

After a real local Plugin import succeeded, changing the original package and
requesting update status failed with `writing-tools 没有可更新的本地来源`.
Import, canonical package publication, and renderer refresh had completed.

## Root Cause

The imported entry initially sets `source.url` to the absolute local package
path. Canonical Plugin publication deliberately removes local repository and
package paths and accepts only HTTP(S) values for `source.url`. The canonical
reread therefore returns a local source with no device-local location, while
`buildPreviewForLocalSource` requires that location for every update check.

## Design Decision Required

The portable canonical resource must not expose device-local absolute paths.
Supporting local source updates therefore requires a device-owned projection
for Plugin source locations, with containment, stale-path, backup, migration,
and deletion behavior defined. Persisting the absolute path in the portable
Plugin resource would weaken the current privacy and portability boundary and
is not recommended.

## Verification Needed After Decision

- Local source identity survives canonical reread and application restart on
  the same device without entering the portable resource bundle.
- A second local revision reports `remote-changed`, creates a recoverable
  snapshot, publishes updated package bytes, and removes temporary materialized
  files.
- Missing, moved, malformed, and symlinked source locations fail closed without
  changing the canonical Plugin or its versions.
