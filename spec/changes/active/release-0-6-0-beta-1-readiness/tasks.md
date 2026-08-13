# PromptHub 0.6.0-beta.1 Readiness Tasks

- [x] `T-BETA1-000` Record requirements, design, verification, scope, and
      analyze result before implementation.
- [x] `T-BETA1-001` Align every shipped version source to `0.6.0-beta.1`.
- [x] `T-BETA1-002` Reproduce quick-gate failures with release-CI Node 24.
- [x] `T-BETA1-003` Fix file-size, Core, CLI, Worker, and Desktop gate failures
      with focused regression verification.
- [x] `T-BETA1-004` Add the beta release record and changelog entry, update the
      release index, and synchronize generated website release metadata.
- [x] `T-BETA1-003A` Repair canonical Desktop settings hydration, align self-hosted startup
      E2E with immutable backup semantics, isolate Web smoke storage, and bound
      Desktop integration / Worker dry-run resources. Coalesce concurrent Rule
      materialization and prevent repeated cache reconciliation on one live
      database connection from deleting in-flight atomic writes. Bound CLI
      workers and split the uneven Desktop unit tail into eight release shards.
- [x] `T-BETA1-005` Pass quick and full release verification.
- [ ] `T-BETA1-006` Confirm a clean, intentional candidate commit and record
      CI artifact/signing/notarization verification before publication.
