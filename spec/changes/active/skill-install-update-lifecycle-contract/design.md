# Design

## Current Failure Boundary

The low-level remote Git/Zip IPC already returns either `saved` or
`safety-review-required`. Installed-Skill update converts that result into a
typed review outcome and opens a dialog. First install instead creates a Skill
row, attempts package persistence, rolls the row back on review-required, and
then replaces the typed review with a plain `Error`. Store detail, quick
install, and Git import therefore cannot approve the staged package.

The initial UI scan and authoritative package scan also have different scope:
the first often sees only `SKILL.md`, while the second sees scripts and package
resources. The later result is expected to be stricter and must be modeled as a
state transition rather than an installation exception.

## `DES-SIL-001` Shared Operation Contract And State Machine

Define shared types in `packages/shared/types/skill.ts`:

```ts
type SkillPackageOperationKind = "install" | "update";

type SkillPackageOperationResult =
  | { status: "completed"; operation: SkillPackageOperationKind; skill: Skill }
  | {
      status: "review-required";
      operation: SkillPackageOperationKind;
      review: SkillUpdateSafetyReview;
    }
  | {
      status: "blocked";
      operation: SkillPackageOperationKind;
      report: SkillSafetyReport;
      failure: SkillPackageOperationFailure;
    }
  | { status: "conflict"; operation: "update"; check: SkillSourceUpdateCheck }
  | {
      status: "source-unavailable";
      operation: SkillPackageOperationKind;
      failure: SkillPackageOperationFailure;
    }
  | { status: "cancelled"; operation: SkillPackageOperationKind }
  | {
      status: "failed";
      operation: SkillPackageOperationKind;
      failure: SkillPackageOperationFailure;
    };
```

Expected states are values. Exceptions are reserved for programmer defects or
unrecoverable runtime failures that cannot be represented by the contract.
Every consumer uses an exhaustive switch guarded by `assertNever`.

The lifecycle is:

```text
idle -> resolving -> staging -> scanning
scanning -> review-required -> staging (fingerprint-pinned retry)
scanning -> blocked
scanning -> applying -> completed
any active phase -> cancelled | source-unavailable | failed
update resolving -> conflict
```

`review-required` is nonterminal and is never counted, logged, or displayed as
an install failure.

## `DES-SIL-002` Ownership And Dependency Direction

- `packages/shared`: request/result/error/source contracts only.
- `packages/core`: pure operation-state and policy helpers; no Electron, DB, or
  filesystem imports.
- `apps/desktop/src/main/services/skill-package-lifecycle.ts`: Desktop
  orchestration over source adapters, staging, safety, `SkillDB`, version
  snapshots, managed repository promotion, and compensation.
- Desktop IPC/preload: validated transport for one lifecycle operation.
- Renderer store: invoke the lifecycle, maintain transient pending review, and
  refresh visible state after completion.
- React components: present shared controller state; no package policy.

This removes durable install/update rules from React components and prevents a
new entry point from inventing another error interpretation.

## `DES-SIL-003` Authoritative Stage-Scan-Apply Pipeline

Each operation call uses a normalized source adapter:

- `remote-git`: repository URL, branch, and Skill directory.
- `remote-zip`: package URL.
- `content-url`: one canonical `SKILL.md` payload.
- `local-directory`: a validated local package directory.
- `cloud-package`: the published Cloud package resolved by the existing main
  Cloud client.

The main orchestrator performs:

1. Validate request and canonical source identity.
2. Resolve and materialize the complete package into a temporary staging root.
3. Validate structure, paths, symlinks, archive entries, and size limits.
4. Compute the v1 package fingerprint.
5. Run mandatory preflight and optional AI scan against staged bytes.
6. Return `blocked` for non-overridable findings.
7. Return `review-required` for unapproved `high-risk`, then remove staging.
8. On safe or fingerprint-approved retry, perform the durable apply.

Catalog/entry scanning remains useful for previews but cannot authorize the
operation. Only the complete staged scan decides apply/review/block.

## `DES-SIL-004` Approval And Trust

Approval carries only `approvedPackageFingerprint`. Every retry restages,
rescans, and recomputes the fingerprint. A mismatch returns a new review and
does not apply.

The renderer may automatically retry a `review-required` result only when its
canonical `sourceKey` is already in `trustedSkillUpdateSourceKeys`. Selecting
"trust this exact source" during first install/update is persisted only after
`completed`. Cancellation, failure, changed bytes, and blocked findings never
persist trust.

Host-wide trust remains prohibited. Trust never skips staging or scanning.

## `DES-SIL-005` Atomicity, Compensation, And Crash Cleanup

### Install

- Stage, validate, scan, and authorize before creating a durable Skill row.
- After authorization, create the row and promote the staged package into its
  managed repository.
- If promotion or baseline finalization fails, remove the created row and
  managed container.
- Install creates its initial version only after package promotion succeeds.

### Update

- Stage, validate, scan, and authorize without touching the current package.
- Create one update snapshot immediately before the managed-repo swap.
- Use staging/backup directory rename for the package replacement.
- If DB metadata/baseline finalization fails, restore the previous package and
  DB state from the snapshot; do not leave the new baseline active.

### Cleanup

- Always remove staging on completion, review, cancel, or failure.
- Startup cleanup removes abandoned lifecycle staging roots older than the
  configured lease while leaving managed repositories untouched.
- Rollback failure returns stable code `ROLLBACK_INCOMPLETE`, preserves the
  recovery artifacts, and surfaces an actionable diagnostic.

## `DES-SIL-006` One Renderer Controller For Every Entry Point

Introduce one controller/hook, tentatively `useSkillPackageOperation`, and one
generic review dialog. It owns:

- current operation and pending source;
- loading and duplicate-click guards;
- authoritative review data;
- exact-source trust selection;
- approval retry and changed-fingerprint handling;
- localized result presentation.

Entry-point behavior:

- Store detail: preview, execute, review if required, then deploy prompt.
- Quick install: execute the same lifecycle; open the shared review instead of
  emitting an error toast.
- Batch install: continue safe items, queue review-required items, and report
  installed/review/blocked/failed/skipped counts separately.
- Git repository import: retain per-Skill results and open/queue review instead
  of reducing failures to names and counts.
- Installed update: migrate to the same controller without weakening conflict
  and overwrite rules.
- My Skills update badges: derive candidates through a pure exact-source
  selector. Prefer `source_id`, then `content_url`, then matching `source_url`;
  allow slug fallback only for a unique legacy record without source identity.
  Compare package fingerprints only when the installed algorithm is the
  current durable v1 algorithm, otherwise fall back conservatively to version.

## `DES-SIL-007` Error Model And Observability

Define stable failure codes such as:

- `SOURCE_UNAVAILABLE`
- `INVALID_PACKAGE`
- `SAFETY_BLOCKED`
- `DUPLICATE_SOURCE`
- `CONFLICT`
- `STAGING_FAILED`
- `PACKAGE_APPLY_FAILED`
- `DATABASE_FINALIZE_FAILED`
- `ROLLBACK_INCOMPLETE`

`review-required` is a result status, not a failure code. Renderer i18n maps
codes to user copy. Sanitized diagnostics include operation kind, phase, source
label, and bounded detail. Credentials, URL userinfo, query/fragment secrets,
and stack traces are never persisted or displayed.

Cloud install reporting must not mark `review-required` as failed. It remains
pending until completion or explicit cancellation; cancellation is reported as
cancelled when the remote contract supports it, otherwise it is not mislabeled
as a package failure.

## `DES-SIL-008` Concurrency And Idempotency

The main lifecycle service owns an in-flight key derived from operation kind,
canonical source identity, and target Skill ID when present. A matching request
joins the existing operation or returns `OPERATION_IN_PROGRESS`; it never starts
a second DB/filesystem mutation.

Install performs a final source-ID/name uniqueness check immediately before DB
creation. Approval retry is idempotent: it either completes the original target
once or returns a deterministic duplicate/conflict result.

## `DES-SIL-009` Compatibility And Migration

- No SQLite schema change is required.
- Existing baseline, source identity, and trust settings remain valid.
- Existing low-level `saveRemoteGitToRepo` and `saveRemoteZipToRepo` APIs remain
  internal migration primitives until all product callers use the lifecycle
  service.
- Update all `installRegistrySkill` callers in one change; TypeScript must not
  allow a mixed `Skill | null` and structured-result world.
- Linked local folders retain the current no-overwrite policy.
- CLI/Web behavior is not silently changed; reusable core/shared contracts are
  available for later adapters, while this change's acceptance gate covers all
  Desktop entry points named in the proposal.

## `DES-SIL-010` Verification Strategy

The first implementation artifact is a failing black-box regression for the
reported Gitea install. Verification layers:

- Pure decision-table tests for every result/status transition.
- Real temporary filesystem and SQLite integration tests for install/update,
  atomic promotion, compensation, and cleanup.
- IPC/preload contract tests for validation and structured outcomes.
- Renderer store tests proving review objects survive without stringification.
- Component tests for detail, quick, batch, and Git import surfaces.
- Security tests for fingerprint changes, blocked findings, traversal,
  symlinks, unsafe archives, oversized fields, secret redaction, and exact
  source trust.
- Concurrency/stress tests for repeated clicks, parallel source operations, and
  large package inventories.
- Desktop typecheck/lint/build, file-size gate, focused coverage, and release
  harness before convergence.

## Alternatives Rejected

### Patch only `installRegistrySkill` catch

Returning the existing exception object would fix one toast but keep divergent
UI paths, pre-scan/authoritative-scan confusion, and renderer-owned durable
orchestration. A future quick/batch/import caller could reproduce the defect.

### Add a Gitea whitelist

Host-wide or owner-based bypass weakens the security boundary and does not fix
the lost result contract. Self-owned code can still be compromised; exact
source trust plus fingerprint approval is the correct boundary.

### Treat all high-risk results as blocked

This avoids review UI but breaks the documented distinction between reviewable
and non-overridable findings and prevents legitimate script-bearing Skills from
being installed.

## Analyze Result

- Requirement links: `FR-SIL-001` through `FR-SIL-010` all map to design,
  verification, and executable tasks.
- Verification links: the escaped user flow is `TEST-SIL-002`; rollback,
  concurrency, adapter, and UI parity have separate tests.
- Blocking conflicts: none. This extends the archived update-review design to
  first install and consolidates orchestration without changing its trust
  boundary.
- Unresolved `[待确认]`: none required before writing the failing regression.

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
