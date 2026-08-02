# ADR-20260802-001: Self-Hosted Web Agent Service Parity

## Status

Accepted

## Context

The first self-hosted Web Agent implementation exposed inventory and settings
but disabled every deeper Agent service because the browser cannot execute all
Desktop-native actions. The product requirement is service parity: Web and
Desktop expose the same Agent domains, while transport and native actions may
differ.

## Decision

Self-hosted Web and Desktop share Agent contracts, core business services, DB
primitives, and renderer service domains. Desktop invokes those services through
Electron preload/IPC and local native adapters. Web invokes them through
authenticated Hono APIs and server-safe adapters.

Browser-inapplicable actions such as installing into the viewer's local Agent,
direct local distribution, native application launch, tray, window controls,
and native file dialogs are adapted or disabled at the action level. Their
owning Agent services remain present.

No cloud account model, connected-device RPC, or new `local`/`user`/`runtime`
database scoping scheme is introduced by this decision.

## Alternatives

| Option | Benefits | Costs/Risks | Decision |
| --- | --- | --- | --- |
| Inventory-only Web | Small implementation | Removes core product services | Rejected |
| Duplicate Web Agent product | Independent implementation | Divergent rules, contracts, and UI | Rejected |
| Shared services with Web transport/adapters | Product parity and one business model | Requires extraction from Electron-only orchestration | Accepted |

## Consequences

- Positive: Web and Desktop use the same Agent service vocabulary and UI model.
- Positive: existing core/DB/domain ownership is preserved.
- Negative: Electron-owned workflows must be separated from their transport and
  native adapters.
- Compatibility/migration: no new account/device scope migration is required.
- Verification: every service requires route/bridge/renderer contract tests and
  native-action adaptation tests.

## Links

- Requirement:
  `spec/changes/active/web-agent-service-parity/specs/web-agent-service-parity/spec.md`
- Change: `spec/changes/active/web-agent-service-parity/`
- Issue: none
- Supersedes / superseded by:
  supersedes `spec/adr/ADR-20260801-001-web-agent-server-host-inventory.md`
