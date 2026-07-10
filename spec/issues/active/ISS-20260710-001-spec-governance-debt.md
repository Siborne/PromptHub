# ISS-20260710-001: Spec Governance Debt

## Status

- State: open
- Created: 2026-07-10
- Owner surface: internal documentation governance
- Related changes:
  `spec/changes/archive/2026/07/2026-07-10-spec-init-upstream-alignment/`
  and
  `spec/changes/archive/2026/07/2026-07-10-spec-governance-single-source-cleanup/`

## Confirmed Gaps

### Active changes without a delta spec

- `desktop-renderer-ui-test-coverage`
- `homepage-changelog-route-retirement`
- `r2-direct-downloads`
- `readme-screenshots-v0-5-6`
- `skill-uninstall-lifecycle`

Each directory requires either a real `specs/<domain>/spec.md` or an explicit
legacy/superseded archive decision. Do not create an empty compliance file.

### Lifecycle review candidates

The following active changes currently combine completed/implemented language
with no unchecked task boxes and require owner review before movement:

- `cli-install-manual-fallback`
- `desktop-issue-179-configured-skill-targets`
- `mcp-env-sync-reapply`
- `mobile-app-shell`
- `rules-managed-copies`
- `skill-source-update-reconciliation`
- `unified-custom-store-sources`

Some remain active because of release, review, convergence, or concurrent work.
Their status must name that condition and its exit criteria; otherwise they
should move to the dated archive.

## Resolved During Discovery

- `spec/changes/index.md` now provides a deterministic active/archive/legacy
  inventory and is checked with `pnpm spec:index:check`.
- `spec/archive/README.md`, `spec/adr/README.md`, and `spec/releases/README.md`
  now contain explicit indexes, including intentional empty-state records.
- Historical records predate typed IDs and remain intentionally compatible;
  new standalone records follow the typed-ID rule.
- `spec-structure-rename` was confirmed as an intermediate, superseded
  topology and archived at
  `spec/changes/archive/2026/07/2026-07-10-spec-structure-rename/`.

## Acceptance Criteria

- Every active change has the required five artifacts and at least one real
  delta spec.
- Active status matches actual remaining implementation/review/convergence
  work.
- Completed changes leave `active/` and update inbound references.
- Changes, issues, ADRs, releases, and project archives have maintainable
  indexes or a deterministic generated inventory.
- No historical path is renamed without a dedicated migration and reference
  scan.
