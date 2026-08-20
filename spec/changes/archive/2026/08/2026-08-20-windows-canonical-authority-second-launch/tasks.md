# Tasks

- [x] `T-WINCAT-001` (`NFR-WINCAT-001`, `DES-WINCAT-001`,
      `TEST-WINCAT-001`): add failing long-path regressions, bound both the
      startup/recovery checkpoint hierarchy and same-directory
      verification/stage database basenames, and retain success/failure
      cleanup.
- [x] `T-WINCAT-002` (`FR-WINCAT-001`, `FR-WINCAT-002`,
      `DES-WINCAT-002`, `TEST-WINCAT-002`): add the fail-closed release-only
      clean-exit control, wait for both window readiness and durable renderer
      persistence migration, and run the packaged Windows smoke twice against
      one deliberately long isolated profile.
- [x] `T-WINCAT-003` (`FR-WINCAT-001`, `FR-WINCAT-002`,
      `NFR-WINCAT-001`, `TEST-WINCAT-003`): run focused Core/Desktop tests,
      types, lint, line limits, spec governance, and the relevant release
      harness; obtain real Windows x64 two-launch evidence before release.
- [x] `T-WINCAT-004`: converge implementation evidence, stable recovery docs,
      release records, and change lifecycle after platform verification.
