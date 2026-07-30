# Website Published Stable Boundary Implementation

## Status

- Phase: converge
- Status: archived

## Shipped

- Public website metadata now follows explicit `stable record` rows.
- Preparation and build versions no longer promote public downloads.
- Missing or inconsistent publication records fail explicitly.

## Verification

- `pnpm --dir website test:release-sync`: 4 tests passed with 100% line,
  branch, and function coverage for the selector.
- `pnpm --dir website sync:release`: passed and retained `v0.5.9`.
- `pnpm --dir website build`: passed; 13 pages built.
- Initial review tests reproduced the premature `0.6.0` promotion before the
  explicit-status fix.

## Analyze

- Traceability complete: yes
- Conflicts/blockers resolved: yes

## Converge

- Stable workflow/knowledge/rules synced: existing release rules already define
  stable-versus-preparation semantics
- Issues/releases/ADRs/indexes synced: release index remains the status source;
  no issue or ADR change
- Final change destination: this dated archive path

## Synced Docs

- This archived change record

## Follow-ups

- Promoting a future stable release requires changing its release-index status
  and adding the matching dated changelog entry.
