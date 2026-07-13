# Skill Install And Update Lifecycle Delta

## Requirements

### `FR-SIL-001` Canonical Lifecycle Contract

All Desktop Skill install and source-update entry points MUST use one canonical
operation contract for source resolution, staging, safety classification,
approval, apply, and rollback. Components and store actions MUST NOT maintain
independent interpretations of the same operation outcome.

### `FR-SIL-002` Structured Expected Outcomes

Expected lifecycle states MUST be returned as discriminated typed results.
At minimum the contract MUST distinguish `completed`, `review-required`,
`blocked`, `conflict`, `source-unavailable`, `cancelled`, and `failed`.
Known outcomes MUST NOT be flattened into generic exceptions or raw strings.

### `FR-SIL-003` Authoritative Complete-Package Review

Catalog metadata or `SKILL.md` preview scanning is advisory. The authoritative
safety decision MUST be based on the fully staged package and MUST occur before
durable install/update mutation. A staged `high-risk` result MUST transition to
`review-required` with the report and package fingerprint; it MUST NOT be
reported as installation failure.

### `FR-SIL-004` Fingerprint Approval And Exact-Source Trust

One-time approval MUST be bound to the exact staged package fingerprint. A
retry MUST stage and scan again; changed bytes invalidate the prior approval.
Persisted trust MUST remain scoped to the exact source identity and MUST only be
saved after a reviewed operation completes successfully.

### `FR-SIL-005` Atomic Apply And Rollback

Install MUST not create a durable Skill row or managed package before staging,
validation, and review authorization finish. Update MUST not change the current
package or source baseline before authorization. Any DB, filesystem, snapshot,
or metadata failure MUST restore the previous durable state and remove staging
artifacts.

### `FR-SIL-006` Entry-Point Consistency

Store detail, quick install, batch install, Git/GitHub/Gitea import, Cloud
install/update, and installed-Skill source update MUST render equivalent states
and actions for the same lifecycle result. Review-required items in batch flows
MUST be queued or reported separately rather than counted as generic failures.

### `FR-SIL-007` Stable Error And Diagnostic Model

User-visible failures MUST be selected from stable error codes and localized
messages. Diagnostic details MUST be sanitized, bounded, and preserve the
operation phase without exposing credentials, URL userinfo, query secrets, or
raw stack traces.

### `FR-SIL-008` Concurrency And Idempotency

Repeated clicks and concurrent install/update attempts for the same source and
target MUST coalesce or return a deterministic in-progress/conflict result.
Approval retry MUST not create duplicate rows, duplicate versions, or parallel
managed repositories.

### `FR-SIL-009` Source Adapter Compatibility

Remote Git, remote Zip, raw content URL, local directory, and Cloud package
sources MUST map into the same lifecycle without weakening their existing
security boundaries. Linked external local directories MUST retain their
existing no-overwrite rule.

### `FR-SIL-010` Regression And Quality Gate

The escaped self-hosted Gitea first-install scenario MUST be a permanent
black-box regression. Changed lifecycle branches require line, function,
branch, and condition coverage, plus integration tests for DB/filesystem/IPC
rollback and UI tests for every install/update entry point.

## Acceptance Scenarios

1. A Gitea Skill whose entry preview is safe but whose four-file staged package
   contains one reviewable high-risk finding returns a review dialog containing
   the authoritative findings, not `安装失败: SAFETY_REVIEW_REQUIRED`.
2. Approving that dialog restages the package, matches the approved
   fingerprint, installs the complete package, records the source baseline, and
   leaves exactly one Skill row and one managed package.
3. If the package changes between review and approval, no durable mutation
   occurs and a new review is returned with the new fingerprint.
4. Cancelling review leaves no Skill row, version, managed package, or staging
   directory.
5. A `blocked` finding remains non-overridable even for a trusted exact source.
6. A safe package completes without showing a review dialog.
7. An installed Skill update follows the same outcome contract and preserves
   the previous package and baseline on failure.
8. Quick, detail, batch, and Git import surfaces expose the same review and
   failure semantics.
9. Two concurrent installs for the same source cannot create duplicate rows or
   repositories.
10. Sanitized diagnostics identify the failing phase and stable code without
    exposing source credentials.
11. A newly installed Skill remains up to date when another enabled store has
    a different source with the same slug. The library badge follows exact
    source identity and compatible package fingerprints rather than whichever
    same-slug entry loaded last.

## Traceability

| Requirement  | Design                       | Verification                          | Task                     |
| ------------ | ---------------------------- | ------------------------------------- | ------------------------ |
| `FR-SIL-001` | `DES-SIL-001`, `DES-SIL-002` | `TEST-SIL-001`                        | `T-SIL-002`, `T-SIL-003` |
| `FR-SIL-002` | `DES-SIL-001`, `DES-SIL-007` | `TEST-SIL-001`, `TEST-SIL-007`        | `T-SIL-002`, `T-SIL-008` |
| `FR-SIL-003` | `DES-SIL-003`                | `TEST-SIL-002`                        | `T-SIL-001`, `T-SIL-004` |
| `FR-SIL-004` | `DES-SIL-004`                | `TEST-SIL-003`                        | `T-SIL-004`, `T-SIL-006` |
| `FR-SIL-005` | `DES-SIL-005`                | `TEST-SIL-004`                        | `T-SIL-003`, `T-SIL-005` |
| `FR-SIL-006` | `DES-SIL-006`                | `TEST-SIL-005`                        | `T-SIL-006`, `T-SIL-007` |
| `FR-SIL-007` | `DES-SIL-007`                | `TEST-SIL-007`                        | `T-SIL-008`              |
| `FR-SIL-008` | `DES-SIL-008`                | `TEST-SIL-006`                        | `T-SIL-003`, `T-SIL-009` |
| `FR-SIL-009` | `DES-SIL-002`, `DES-SIL-009` | `TEST-SIL-008`                        | `T-SIL-003`, `T-SIL-005` |
| `FR-SIL-010` | `DES-SIL-010`                | `TEST-SIL-001` through `TEST-SIL-009` | `T-SIL-001`, `T-SIL-009` |
