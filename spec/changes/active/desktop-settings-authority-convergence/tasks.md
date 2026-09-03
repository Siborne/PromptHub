# Desktop Settings Authority Convergence Tasks

- [x] `T-CONFIG-001` (`FR-CONFIG-001`, `DES-CONFIG-001`,
      `TEST-CONFIG-001`): accept and record canonical `config/` ownership and
      the SQLite/renderer demotion decision.
- [ ] `T-CONFIG-002` (`FR-CONFIG-002`, `DES-CONFIG-002`,
      `TEST-CONFIG-002`): inventory every current Settings field and produce the
      typed ownership/scope/secret/backup/apply registry without adding a second
      policy list.
- [ ] `T-CONFIG-003` (`FR-CONFIG-003`, `DES-CONFIG-003`,
      `TEST-CONFIG-003`, `TEST-CONFIG-004`): add failing repository/IPC tests,
      then implement the serialized atomic main/Core configuration patch path.
- [ ] `T-CONFIG-004` (`FR-CONFIG-001`, `FR-CONFIG-003`,
      `NFR-CONFIG-001`, `TEST-CONFIG-001`, `TEST-CONFIG-003`,
      `TEST-CONFIG-007`): route startup and renderer actions through the single
      committed snapshot; remove background-subscription durability claims.
- [ ] `T-CONFIG-005` (`FR-CONFIG-004`, `DES-CONFIG-004`,
      `TEST-CONFIG-001`, `TEST-CONFIG-005`): migrate legacy conflicts once,
      verify first/second restart, then retire SQLite and LocalStorage authority
      and normal dual writes.
- [ ] `T-CONFIG-006` (`FR-CONFIG-005`, `DES-CONFIG-005`,
      `TEST-CONFIG-006`): align database rebuild, upgrade safety points,
      portable export, settings restore, diagnostics, redaction, and rollback.
- [ ] `T-CONFIG-007` (`NFR-CONFIG-001`, `DES-CONFIG-005`,
      `TEST-CONFIG-007`): verify bounded size, serialized concurrency, file I/O,
      failure cleanup, unknown-newer behavior, and performance budgets.
- [x] `T-CONFIG-008`: complete the planning Analyze gate with no blocking
      conflict or unresolved material decision.
- [ ] `T-CONFIG-009`: converge stable knowledge/rules, close superseded
      compatibility behavior, record actual verification, and archive only
      after implementation is released.
