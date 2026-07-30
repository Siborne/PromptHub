# Tasks

## TDD Sequence

- [x] `T-SYNC191-001`: Add the red Web contract tests for current
      `preflight`, legacy `static`, unknown method removal, and strict rejection of
      malformed non-method fields. Covers `FR-SYNC191-001`,
      `FR-SYNC191-002`, `TEST-SYNC191-001`, `TEST-SYNC191-002`.
- [x] `T-SYNC191-002`: Implement the shared compatibility helper and connect
      Desktop import plus Web parsing without changing unrelated snapshot fields.
      Covers `DES-SYNC191-001`, `DES-SYNC191-002`.
- [ ] `T-SYNC191-003`: Add route/repository failure and restored-trust
      regressions, then enforce the no-write and no-authorization invariants.
      Covers `FR-SYNC191-003`, `DES-SYNC191-003`, `TEST-SYNC191-003`.
- [ ] `T-SYNC191-004`: Add the bounded large-inventory regression and record
      time/memory observations for the compatibility pass. Covers
      `NFR-SYNC191-001`, `TEST-SYNC191-004`.

## Verification And Convergence

- [ ] `T-SYNC191-005`: Run focused shared, Web, and Desktop tests with coverage
      for every changed branch, followed by the changed-surface harness.
- [ ] `T-SYNC191-006`: Run shared/Desktop/Web typechecks, targeted lint,
      `pnpm spec:test`, `pnpm spec:index:check`, and `git diff --check`.
- [x] `T-SYNC191-007`: Update `implementation.md`, stable Skill/sync knowledge,
      and the local issue overlay; keep #191 open until the containing release is
      published.
- [ ] `T-SYNC191-008`: Complete converge and archive this change under the
      dated archive path.
