# Skills Delta Spec

## Requirements

### FR-SUT-001 Accurate Legacy Reconciliation

When an installed Skill has a legacy package fingerprint but its installed entry content matches the current remote entry content, PromptHub MUST initialize a v1 package baseline from the current local package instead of comparing incompatible fingerprint algorithms and reporting an update.

### FR-SUT-002 Structured Safety Review

Remote package updates that produce `high-risk` findings MUST return a structured `safety-review-required` result containing the report, source identity, and staged package fingerprint. They MUST NOT mutate the current package or source baseline before approval.

### FR-SUT-003 Fingerprint-Pinned Approval

A one-time approval MUST apply only when a newly staged package has the exact approved fingerprint. A changed package MUST require a new review.

### FR-SUT-004 Exact-Source Trust

Users MAY persist trust for one exact Skill source identity. Trust MUST be scoped by source ID or canonical repository, branch, and Skill directory; host-wide trust is prohibited.

### FR-SUT-005 Hard Safety Boundary

`blocked` findings, path traversal, invalid package structure, unsafe archive entries, and internal-source hard failures MUST remain non-overridable even for trusted sources.

### FR-SUT-006 Semantic Content Hashing

Skill content hashing MUST use the shared YAML parser for frontmatter semantics and MUST preserve literal/folded block values and nested structures.

### FR-SUT-007 Bounded Staged-Source Verification

Source-address verification for an already staged and locally scanned package MUST complete within a bounded deadline. An unreachable custom source MUST yield a provenance warning without blocking the local package update; sources without a materialized package retain the strict internal-source boundary.

## Acceptance Criteria

### AC-SUT-001 User Report: Unchanged Private Gitea Skill

Given a pre-v1 Skill installed from a private Gitea repository, when local and remote `SKILL.md` content match and the remote package is unchanged, checking updates returns `up-to-date` and initializes the v1 baseline.

### AC-SUT-002 User Report: Self-Owned High-Risk Skill

Given a self-owned Skill package containing scripts or another reviewable high-risk finding, updating returns a review dialog with findings instead of a generic IPC error. Approving once updates only the reviewed fingerprint.

### AC-SUT-003 Trusted Exact Source

When the user marks the exact source as trusted, later `high-risk` updates from that source are automatically fingerprint-approved after scanning, while a `blocked` result is still rejected.

### AC-SUT-004 Revocation

The user can remove a trusted source from Skill safety settings, after which the next high-risk update requires review again.

### AC-SUT-005 Unreachable Self-Hosted Source

Given an already staged package from a self-hosted Gitea source whose address cannot be resolved, the update completes with a visible provenance warning and never waits for an unbounded DNS lookup.

## Traceability

| Requirement  | Design        | Verification   | Task        |
| ------------ | ------------- | -------------- | ----------- |
| `FR-SUT-001` | `DES-SUT-001` | `TEST-SUT-001` | `T-SUT-002` |
| `FR-SUT-002` | `DES-SUT-002` | `TEST-SUT-002` | `T-SUT-003` |
| `FR-SUT-003` | `DES-SUT-003` | `TEST-SUT-003` | `T-SUT-003` |
| `FR-SUT-004` | `DES-SUT-004` | `TEST-SUT-004` | `T-SUT-004` |
| `FR-SUT-005` | `DES-SUT-003` | `TEST-SUT-005` | `T-SUT-003` |
| `FR-SUT-006` | `DES-SUT-001` | `TEST-SUT-006` | `T-SUT-002` |
| `FR-SUT-007` | `DES-SUT-006` | `TEST-SUT-007` | `T-SUT-006` |
