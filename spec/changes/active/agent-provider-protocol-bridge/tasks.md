# Agent Provider Protocol Bridge Tasks

- [x] `T-PROTOCOL-001` Define the four canonical protocol names, record the
  direct-versus-bridge boundary, and cover Kimi's existing four native provider
  kinds with a renderer regression.
- [x] `T-PROTOCOL-002` Add a shared route planner and test every verified Agent
  adapter and canonical protocol without exposing an unavailable bridge route
  as usable.
- [ ] `T-PROTOCOL-003` Add the typed route preview and persistence contracts and
  make source listing, import, activation, and testing consume the same plan.
- [ ] `T-PROTOCOL-004` Implement canonical request/event codecs for all four
  protocols with black-box, branch, malformed-input, tool, reasoning, streaming,
  cancellation, usage, and provider-error fixtures.
- [ ] `T-PROTOCOL-005` Implement the authenticated bounded loopback lifecycle,
  secret resolution, activation rollback, concurrency limits, timeouts, and
  resource cleanup tests.
- [ ] `T-PROTOCOL-006` Add bridge route preview and activation UI, direct/bridge
  status, stable diagnostics, all seven locales, and cross-platform E2E coverage.
- [ ] `T-PROTOCOL-007` Run focused tests, shared/Desktop typechecks, build,
  release-risk harness, and stress/resource measurements.
- [ ] `T-PROTOCOL-008` Sync stable AI protocol and Desktop behavior docs, finish
  Converge, archive the change, and regenerate the change index.
