# ADR-20260801-001: Web Agent Server-Host Inventory Boundary

## Status

Superseded by `ADR-20260802-001`

## Context

The authenticated Web workspace reuses the Desktop renderer, while Desktop
Agent management assumes direct access to a user's local Agent roots,
configuration, sessions, provider secrets, executables, and applications. A
self-hosted Web server can run on another machine and can serve multiple users,
so browser paths cannot be treated as Desktop paths and machine-wide native
state cannot be silently assigned to per-user settings.

## Decision

Web exposes a bounded logical Agent inventory to every authenticated user.
Per-user settings own built-in overrides, custom Agent definitions, disabled
IDs, legacy custom roots, and identity preferences.

Administrators additionally receive read-only shallow existence checks for
configured roots on the self-hosted server process account. Non-admin users do
not trigger server filesystem probes. Config contents, Providers, sessions,
usage, process launch, maintenance, asset operations, and filesystem mutations
remain disabled until they have separate user-scoped ownership, authorization,
secret-custody, and audit contracts.

## Alternatives

| Option | Benefits | Costs/Risks | Decision |
| --- | --- | --- | --- |
| Full server-host management | Closest to Desktop; can reuse filesystem adapters | Machine-wide state conflicts with per-user ownership and expands remote execution and secret exposure | Rejected for this slice |
| Connected Desktop management | Preserves the meaning of device-local paths and sessions | Requires authenticated device RPC, online state, replay protection, authorization, and auditing | Deferred |
| Logical inventory only | Safest multi-user boundary and portable settings | Cannot report whether server-host roots exist | Selected for non-admin users |
| Logical inventory plus admin shallow detection | Gives administrators useful server-host status without exposing native mutations | Detection refers to the server process account, not the browser device | Selected for administrators |

## Consequences

- Positive: the Web Agents workspace is useful without claiming unsupported
  Desktop-native capabilities.
- Positive: ordinary users cannot use Agent inventory as a server filesystem
  oracle.
- Negative: Web does not yet provide deep Desktop Agent feature parity.
- Compatibility/migration: no schema migration is required; existing per-user
  settings and Desktop snapshots remain the portable source of truth.
- Verification: route, service, bridge, state, capability, isolation, cache,
  performance, type, lint, and production-build checks cover the initial slice.

## Links

- Requirement:
  `spec/changes/archive/2026/08/2026-08-01-web-agent-management/specs/web-agent-management/spec.md`
- Change:
  `spec/changes/archive/2026/08/2026-08-01-web-agent-management/`
- Issue: none
- Supersedes / superseded by: superseded by
  `spec/adr/ADR-20260802-001-web-agent-service-parity.md`
