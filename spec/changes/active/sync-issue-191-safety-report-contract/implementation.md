# Implementation

## Status

- Phase: implement
- Status: verification-pending

## Shipped

- Added one Shared compatibility normalizer used by Desktop backup import and
  Web snapshot parsing.
- Current `ai` and `preflight` provenance is preserved, legacy `static` maps to
  `preflight`, and unknown string methods remove only the auxiliary report.
- Non-method report validation remains strict in the Web Zod contract.

## Verification

- Shared: 25 tests passed; the new normalizer has 100% line/branch/function
  coverage, including a 10,000-Skill single-read regression.
- Web snapshot contract: 7 tests passed.
- Web backup route: malformed non-provenance safety data returns 422 and leaves
  no backup directory.
- Desktop backup format: 14 tests passed.
- Shared, Web, and Desktop typechecks plus targeted Web/Desktop ESLint: passed.
- Restored-authorization integration and bounded time/memory measurement remain
  follow-up release gates.

## Analyze

- Traceability complete: implementation is mapped; restored-authorization and
  bounded-inventory verification tasks remain open.
- Conflicts/blockers resolved: the shared `ai | preflight` type is canonical;
  legacy `static` maps to `preflight`; unknown provenance removes only the
  auxiliary report.

## Converge

- Stable sync behavior and local issue overlay synced: yes.
- GitHub issue remains open until the containing release is published.
- Final change destination: active until release assignment.

## Synced Docs

- `spec/knowledge/behavior/sync.md`

## Follow-ups

- Re-audit any other import/export codec that rewrites scan provenance instead
  of using the shared compatibility helper.
