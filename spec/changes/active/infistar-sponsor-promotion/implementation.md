# Infistar Sponsor Promotion Implementation

## Status

Local implementation and focused verification are complete. Publication and
change archival remain pending because this work has not been committed or
released.

## Traceability

| Requirement       | Design        | Verification                              | Task                  |
| ----------------- | ------------- | ----------------------------------------- | --------------------- |
| `FR-INFISTAR-001` | Placement     | `TEST-INFISTAR-001` locale/link parity    | `T-INFISTAR-001..002` |
| `FR-INFISTAR-002` | Copy Boundary | `TEST-INFISTAR-002` disclosure scan       | `T-INFISTAR-001..003` |
| `FR-INFISTAR-003` | Copy Boundary | `TEST-INFISTAR-003` placeholder rejection | `T-INFISTAR-001..003` |

## Analyze Gate

- The change is documentation-only and does not alter provider presets, runtime
  routing, application UI, or release metadata.
- The affiliate URL returned HTTP 200 and normalized to the same host and query
  parameters without dropping the referral identity.
- The supplied fixed-benefit wording is unresolved and is not publishable as a
  guaranteed offer.

## Implemented Surfaces

- Added the disclosed partner table to the root README and all six localized
  README files.
- Positioned each README table after the contents and before the download
  section; the bottom sponsor section now contains only personal donation
  methods.
- Added the same commercial boundary to `docs/sponsors.md` and the Chinese and
  English website backer pages.
- Preserved the supplied affiliate identity in every registration link.
- Kept the existing community donation records and donation methods unchanged.

## Verification

- `TEST-INFISTAR-001`: a deterministic locale scan confirmed exactly two copies
  of the affiliate URL in each of the ten public documents and confirmed the
  partner identity in every file.
- `TEST-INFISTAR-002`: the same scan confirmed a localized affiliate disclosure
  in every document.
- `TEST-INFISTAR-003`: the scan rejected unresolved fixed-benefit wording; no
  fixed USD credit or first-deposit promise is present.
- A placement scan confirmed that every localized partner table appears before
  the download anchor, occurs once, and is no longer nested under the bottom
  personal sponsor section.
- Prettier check passed for all ten changed public Markdown documents.
- The affiliate URL returned HTTP 200 and preserved `aff=RX9CVLVQ` and
  `ref_source=link` after redirect normalization.
- `pnpm --dir website build` passed and generated both backer pages with the
  table, links, and disclosure. The build emitted only the existing stale
  Browserslist-data advisory.
- Spec index and traceability checks passed after the implementation record was
  updated.

## Release Boundary

No application code, provider preset, runtime behavior, release version, or
third-party service configuration changed. The full release harness was not run
because this batch changes static public documentation only; the website build
is the relevant executable gate.
