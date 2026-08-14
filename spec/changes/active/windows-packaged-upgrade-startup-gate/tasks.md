# Tasks

- [x] `T-WINSTART-001` (`FR-WINSTART-001`, `DES-WINSTART-001`,
      `TEST-WINSTART-001`): add failing Windows-handle regression tests and repair
      all in-scope read-only file flushes.
- [x] `T-WINSTART-002` (`FR-WINSTART-002`, `DES-WINSTART-002`,
      `TEST-WINSTART-002`): add the packaged Windows upgrade smoke and release
      workflow gate.
- [ ] `T-WINSTART-003` (`NFR-WINSTART-001`, `DES-WINSTART-003`,
      `TEST-WINSTART-003`): verify bounded cleanup, run local release gates, push an
      isolated commit, and run the manual full release workflow.
- [ ] `T-WINSTART-004` (`FR-WINSTART-002`, `DES-WINSTART-002`,
      `TEST-WINSTART-003`): update release records and keep publication blocked
      until all checks pass.
- [x] `T-WINSTART-005` (`FR-WINSTART-001`, `DES-WINSTART-001`,
      `TEST-WINSTART-005`): tolerate unsupported directory fsync after the
      desktop skill reconciliation marker has been atomically committed.
- [x] `T-WINSTART-006` (`NFR-WINSTART-001`, `DES-WINSTART-003`,
      `TEST-WINSTART-006`): wait for packaged-process close and retry bounded
      transient Windows cleanup failures without hiding persistent errors.
