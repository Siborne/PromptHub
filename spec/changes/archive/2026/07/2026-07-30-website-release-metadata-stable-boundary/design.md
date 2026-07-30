# Website Published Stable Boundary Design

<!-- traceability: enforced -->

## `DES-WEBREL-001`: Release Index Is The Publication Pointer

`website/scripts/sync-release.mjs` reads `spec/releases/README.md` and
`CHANGELOG.md`. A pure helper scans only rows whose status is exactly
`stable record`, selects the highest stable semver, and resolves its release
date from the matching changelog heading.

This separates:

- build version: root and application manifests
- publication status: release index
- release narrative and date: changelog

## `DES-WEBREL-002`: Explicit Failure

The generator throws when no stable record exists or when the selected record
has no dated changelog entry. It must not silently fall back to a preparation
or package version.

## Complexity

Release-index selection and changelog lookup are linear in their respective
input sizes, `O(n + m)`, with constant additional working space. Generation is
local and performs no network I/O.

## Failure And Rollback

- External boundary: repository file reads and generated file writes only
- Partial failure behavior: validation throws before generated outputs are
  written
- Recovery: align the release index and changelog, then rerun synchronization

## Analyze Result

- Requirement links: `FR-WEBREL-001`, `NFR-WEBREL-001`
- Verification links: `TEST-WEBREL-001` through `TEST-WEBREL-005`
- Blocking conflicts: none
- Unresolved `[待确认]`: none

## Traceability

| Requirement      | Design                             | Verification                                                                                  | Task                                           |
| ---------------- | ---------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `FR-WEBREL-001`  | `DES-WEBREL-001`, `DES-WEBREL-002` | `TEST-WEBREL-001`, `TEST-WEBREL-002`, `TEST-WEBREL-003`, `TEST-WEBREL-004`, `TEST-WEBREL-005` | `T-WEBREL-001`, `T-WEBREL-002`, `T-WEBREL-003` |
| `NFR-WEBREL-001` | `DES-WEBREL-001`                   | `TEST-WEBREL-002`, `TEST-WEBREL-005`                                                          | `T-WEBREL-002`, `T-WEBREL-003`                 |
