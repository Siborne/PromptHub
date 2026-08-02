# Tasks

- [x] `T-WEB-AGENT-PARITY-001` Audit Desktop Agent service domains, shared
      contracts, Electron-only adapters, Web services, and current route/bridge gaps.
- [x] `T-WEB-AGENT-PARITY-002` Correct the architecture boundary to self-hosted
      Web service parity and supersede the inventory-only product boundary.
- [x] `T-WEB-AGENT-PARITY-003` Extract reusable Agent orchestration from
      Electron-only modules and define server adapter contracts.
- [x] `T-WEB-AGENT-PARITY-004` Write failing Web route/bridge tests for every
      Agent service domain, including redaction and native-action adaptation.
- [ ] `T-WEB-AGENT-PARITY-005` Implement the Web Agent service routes, browser
      bridge, stores, and shared service-domain UI.
  - [x] Add the uniform service manifest/domain routes, bridge, and bounded UI.
  - [x] Connect Skill, MCP, Plugin, Rule, Definition, Provider, Appearance,
        Config summary, and Maintenance read adapters.
  - [x] Add bounded Session index summaries from the shared DB primitive.
  - [x] Add Provider CRUD/export with encrypted server-side secret custody.
  - [x] Add Config list/read/write with redaction, optimistic revision checks,
        encrypted backup, atomic replace, verification, and rollback.
  - [x] Add bounded Session index search, pagination, and redacted detail UI.
  - [x] Remove desktop-only native import, activation, and file-manager
        affordances from the browser presentation.
  - [ ] Add native Session transcript adapters, Usage, and Appearance
        import/export operations.
- [ ] `T-WEB-AGENT-PARITY-006` Add path, symlink, size, pagination, concurrency,
      cache, rollback, error-redaction, integration, build, and performance tests.
  - [x] Cover path/symlink rejection, bounded directory visits, bounded file
        probe concurrency, inventory caching, raw-error redaction, and production
        Web builds.
  - [x] Cover bounded Session index summary reads.
  - [x] Cover revision-safe Config mutations, encrypted backups, rollback,
        Provider compensation, secret-store concurrency, and Session pagination.
  - [x] Cover browser-specific Provider empty-state semantics and hidden native
        file-manager actions.
  - [ ] Cover native transcript pagination, usage probe caching, and remaining
        domain-specific payload size limits.
- [ ] `T-WEB-AGENT-PARITY-007` Converge stable Web/Agent knowledge, update the
      active Agent workbench package boundary, and archive this change.
