# Tasks

- [x] `T-SKILL-211-001` Add failing adapter tests for missing/failing Git with
  successful archive fallback across install and snapshot/fingerprint paths.
  (`FR-SKILL-211-001`, `DES-SKILL-211-001`, `TEST-SKILL-211-001`)
- [x] `T-SKILL-211-002` Add full-package, selector, unsafe archive, cleanup and
  rollback assertions for the fallback path. (`FR-SKILL-211-002`,
  `DES-SKILL-211-001/002`, `TEST-SKILL-211-002`)
- [x] `T-SKILL-211-003` Add structured missing-Git/dual-transport failure
  reasons, localized package-operation copy and branch-discovery guidance.
  (`FR-SKILL-211-003`, `DES-SKILL-211-003/004`, `TEST-SKILL-211-003`)
- [x] `T-SKILL-211-004` Prove fallback eligibility, URL redaction/encoding,
  SSH exclusion, proxy/SSRF reuse and bounded attempts. (`FR-SKILL-211-004`,
  `DES-SKILL-211-002`, `TEST-SKILL-211-004`)
- [x] `T-SKILL-211-005` Run targeted static scans, focused coverage/tests,
  typecheck, file-size/lint/build or the changed-surface harness as required;
  record skipped real-Windows verification.
- [ ] `T-SKILL-211-006` Complete real Windows packaged UI acceptance, then
  converge the local issue/release state where conflict-free and archive the
  change. Stable Skill behavior, regression matrix and implementation evidence
  are already synchronized; the existing dirty issue snapshot files remain
  untouched.

## Verification Plan

- `TEST-SKILL-211-001`: black-box adapter fallback succeeds without Git and
  returns a usable managed package/snapshot.
- `TEST-SKILL-211-002`: full inventory plus adversarial archive/package paths
  preserve the existing validation and cleanup invariants.
- `TEST-SKILL-211-003`: lifecycle reason survives to localized renderer copy;
  raw `spawn git ENOENT` and source secrets are not rendered.
- `TEST-SKILL-211-004`: public HTTPS is eligible; SSH/plain HTTP/private hosts
  do not trigger anonymous archive fallback; only one HTTP attempt occurs.

## Test Methods

- Black-box filesystem: required.
- White-box branch/condition: required for every fallback decision.
- Boundary/security: required for branch encoding, credentials, traversal,
  redirects and SSRF eligibility.
- Failure/rollback: required for clone, fetch, extract, validate and cleanup.
- Integration/contract: required for lifecycle result and renderer message.
- Performance/stress: existing package/archive budgets remain authoritative;
  add bounded-attempt assertions rather than a new large network benchmark.
