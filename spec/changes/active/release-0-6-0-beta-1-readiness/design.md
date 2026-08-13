# PromptHub 0.6.0-beta.1 Readiness Design

<!-- traceability: enforced -->

## `DES-BETA1-001`: Version And Publication Sources

Build identity comes from shipped manifests and uses `0.6.0-beta.1`. Public
stable identity remains selected from dated stable release records. The beta
record and tag-specific release page are separate from stable download links.

## `DES-BETA1-002`: Gate Repair

Reproduce failures under CI-aligned Node 24. Fix each owning module at its
lowest effective layer:

- split oversized tests by behavioral responsibility;
- remove avoidable repeated filesystem/database work from scale paths;
- run the canonical-storage scale budget as a single-worker release check,
  outside the parallel unit-test pool, without raising its time or memory
  limits;
- isolate suite setup cost from per-command CLI test execution;
- make Worker authentication tests deterministic without weakening runtime
  password handling;
- split the large Desktop unit inventory into eight bounded two-worker shards,
  serialized with the other I/O-heavy suites, while retaining every test;
- cap CLI file parallelism at four workers so the suite retains headroom when
  the release harness runs one concurrent static check;
- terminate a failed verification check's residual POSIX process group so
  orphaned test workers cannot contaminate later checks.
- hydrate canonical renderer settings before startup automation, update the
  self-hosted E2E contract to immutable automatic backups, and keep smoke data
  inside task-owned temporary roots;
- coalesce concurrent first-time Rule materialization per Rule and reconcile
  canonical Rule cache workspaces once per live database connection, so a
  second IPC cannot replace a directory containing another IPC's atomic write;
- split Desktop integration tests into four serialized single-worker shards
  and disable Wrangler telemetry during the Worker dry-run so both gates have
  bounded memory and process lifetimes.

The inventory and test runners remain bounded. No retry loop or raised budget
may mask deterministic regressions.

## `DES-BETA1-003`: Candidate Verification

Complete each repair batch, then run quick verification followed by full
verification. The isolated Core storage performance budget runs only in the
full release/package profiles. Packaging and signed artifact checks remain
workflow-owned and are required on the resulting draft release before
publication.

## Analyze Result

- Source of truth: package manifests for build identity; release records for
  publication identity; repository verification harness for quality state.
- Data/storage delta: none.
- IPC/API delta: none from release preparation itself.
- Blocking design conflict: none. The existing `0.6.0` stable preparation
  remains the parent release-line record; this change owns the first preview.
- Unresolved `[待确认]`: none.

## Traceability

| Requirement     | Design          | Verification                     | Task                                   |
| --------------- | --------------- | -------------------------------- | -------------------------------------- |
| `FR-BETA1-001`  | `DES-BETA1-001` | `TEST-BETA1-001`, `-004`         | `T-BETA1-001`, `-004`                  |
| `FR-BETA1-002`  | `DES-BETA1-002` | `TEST-BETA1-002`, `-003`         | `T-BETA1-002`, `-003`, `-003A`, `-005` |
| `FR-BETA1-003`  | `DES-BETA1-001` | `TEST-BETA1-004`                 | `T-BETA1-004`                          |
| `NFR-BETA1-001` | `DES-BETA1-003` | `TEST-BETA1-002`, `-003`, `-005` | `T-BETA1-005`, `-006`                  |
