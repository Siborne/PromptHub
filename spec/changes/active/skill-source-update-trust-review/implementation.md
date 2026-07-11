# Implementation

## Status

Implemented and verified on 2026-07-11.

## User Report Fixtures

- Unchanged self-hosted Gitea Skill incorrectly reports an update.
- A self-owned four-file Skill package returns one high-risk and three warning findings, then fails with a generic `SAFETY_SCAN_BLOCKED_UPDATE` IPC error and offers no review or trust action.

## Verification

- `TEST-SUT-001`: algorithm-aware reconciliation returns `up-to-date` for the unchanged legacy private Gitea fixture and initializes the v1 baseline.
- `TEST-SUT-002`: main/IPC tests return `safety-review-required` with report, package fingerprint, and exact source key without DB mutation.
- `TEST-SUT-003`: main tests reject a mismatched approval fingerprint and accept only the exact staged fingerprint.
- `TEST-SUT-004`: settings tests cover trust deduplication/revocation; store tests cover scan-then-auto-retry for an exact trusted source; the detail component covers manual review and successful trust persistence.
- `TEST-SUT-005`: unsafe archive/path traversal and `blocked` preflight results remain non-overridable even when an approval fingerprint is supplied.
- `TEST-SUT-006`: block scalars and nested YAML maps normalize through the shared parser and produce stable semantic hashes.
- `TEST-SUT-007`: a never-resolving address resolver returns a local-package warning after the configured deadline; remote Git package fixtures complete without the prior 30-second DNS timeouts.

## Executed Checks

- Desktop TypeScript typecheck: passed.
- Focused Skill suites: 149 tests passed across reconciliation, hashing, IPC, settings, store, and detail UI.
- Main fingerprint/blocked boundary selection: 2 tests passed.
- Safety scanner and remote Git package verification: 26 tests passed.
- Focused ESLint for changed TypeScript/TSX files: passed.
- Desktop production build: passed.
- i18n locale parser/regression tests passed; the broader `test:i18n` command has two existing web-runtime visibility failures caused by concurrent changes in `runtime.ts`/UI routing outside this change. Those failures do not involve the new locale keys or Skill update review flow.

## Shipped Behavior

- Legacy and v1 package fingerprints are no longer directly compared; compatible legacy rows use the entry hash to initialize a v1 baseline.
- All Skill content hash normalization now uses the shared YAML parser, including block and nested values.
- Git/Zip updates always stage and run mandatory local preflight. Optional AI and preflight findings are combined before the first review.
- Reviewable high-risk results cross IPC as structured data; blocked and structural failures remain hard errors.
- Approval is bound to the staged SHA-256 package fingerprint. Review-only attempts discard their unchanged version snapshot.
- Exact source trust is persisted only after a successful manual retry, automatically re-approves later scanned high-risk fingerprints, and can be revoked from Skill settings.
- Source address verification is bounded to keep staged custom Gitea/Git package updates responsive; unresolved local-package provenance is surfaced as a warning while non-materialized sources retain the hard boundary.
