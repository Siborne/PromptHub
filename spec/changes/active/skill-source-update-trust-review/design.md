# Design

## DES-SUT-001 Algorithm-Aware Reconciliation

Legacy directory fingerprints are never compared with v1 SHA-256 package fingerprints. When legacy entry content proves local and remote entry equality, the current local v1 package fingerprint becomes an inferred baseline and the check returns `up-to-date` with baseline initialization. Skill content hash normalization delegates YAML parsing/serialization to `packages/core`.

## DES-SUT-002 Structured Review Contract

Remote Git/Zip materialization returns either `saved` or `safety-review-required`. Review data contains a sanitized safety report, the exact package fingerprint, and the canonical source key. The managed repo and DB baseline remain unchanged for review-required results.

## DES-SUT-003 Safe Approval

The retry request may carry `approvedPackageFingerprint`. Main validates the input, stages and scans again, computes the current fingerprint, and bypasses only a `high-risk` result when fingerprints match. `blocked` and structural validation failures always throw.

## DES-SUT-004 Trust Ownership

Renderer settings own a persisted list of exact trusted Skill source keys. Trust does not skip scanning: on a review-required result the renderer automatically retries with that result's fingerprint. A newly selected trust is persisted only after the reviewed fingerprint updates successfully. The settings UI lists and revokes trusted sources. IPC does not accept host-wide trust.

## DES-SUT-005 UI Flow

Installed Skill detail stores a pending update review. The dialog displays the report summary and findings, provides a trust checkbox, and supports cancel or update-anyway. Approval retries the same update with the reviewed fingerprint; selecting trust persists the exact source key only after that retry succeeds.

## DES-SUT-006 Bounded Source Verification

Source-address verification is time-bounded. A staged local package uses a short timeout because its bytes have already been materialized and scanned; an unresolved address becomes a provenance warning rather than blocking the update. A source without a local package retains the stricter blocked-source behavior.

## Data And Compatibility

- SQLite: no schema change.
- Settings: add `trustedSkillUpdateSourceKeys`, persisted by the existing renderer settings store.
- IPC/preload/shared types: add structured save/review result and optional approved fingerprint.
- Filesystem: staging and atomic replacement remain unchanged.
- Compatibility: existing callers without approval receive review-required results for `high-risk`; safe packages continue directly.

## Security

- Validate all new IPC string fields and maximum lengths.
- Never persist credentials, query strings, or raw URLs containing userinfo in trust labels.
- Trust keys use canonical source identity, branch, and directory.
- Approval is content-addressed; changed bytes invalidate the approval.
- `blocked` and structural failures cannot be approved.
- A stalled DNS/address lookup cannot keep a local package update pending indefinitely.
