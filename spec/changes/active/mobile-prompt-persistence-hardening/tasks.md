# Mobile Prompt Persistence Hardening Tasks

- [ ] `T-MOBILE-001`: Record the storage boundary and implement versioned,
  asynchronous SQLite initialization. Covers `FR-MOBILE-001`,
  `DES-MOBILE-001`, `TEST-MOBILE-001`.
- [ ] `T-MOBILE-002`: Harden Prompt row parsing and repository CRUD errors.
  Covers `FR-MOBILE-001`, `DES-MOBILE-001`, `TEST-MOBILE-002`.
- [ ] `T-MOBILE-003`: Add confirmed deletion and visible operation errors.
  Covers `FR-MOBILE-002`, `DES-MOBILE-002`, `TEST-MOBILE-004`.
- [ ] `T-MOBILE-004`: Verify Prompt create/edit/delete against real SQLite.
  Covers `FR-MOBILE-002`, `DES-MOBILE-002`, `TEST-MOBILE-001`.
- [ ] `T-MOBILE-005`: Refresh Prompt detail state on route focus. Covers
  `FR-MOBILE-003`, `DES-MOBILE-003`, `TEST-MOBILE-005`.
- [ ] `T-MOBILE-006`: Add Prompt search/filter policy and tests. Covers
  `FR-MOBILE-004`, `DES-MOBILE-004`, `TEST-MOBILE-003`.
- [ ] `T-MOBILE-007`: Remove misleading inert workbench actions and wire
  functional Prompt, Skill, and Store controls. Covers `FR-MOBILE-004`,
  `DES-MOBILE-004`, `TEST-MOBILE-005`.
- [ ] `T-MOBILE-008`: Localize the Prompt workflow in all seven locales.
  Covers `FR-MOBILE-005`, `DES-MOBILE-005`, `TEST-MOBILE-004`.
- [ ] `T-MOBILE-009`: Run mobile tests, typecheck, focused coverage, Expo
  export, and browser workflow verification. Covers `TEST-MOBILE-005`.
- [ ] `T-MOBILE-010`: Sync stable mobile behavior and implementation records.
- [ ] `T-MOBILE-011`: Run the non-quick release harness when stable publishing
  policy requires it.
- [ ] `T-MOBILE-012`: Complete native iOS and Android release-candidate checks
  before archiving this change.
