# Implementation

## Status

- Phase: converge
- Status: implemented and verified

## Shipped

- Added authenticated `GET /api/agents` inventory and shared response contracts.
- Enabled the Agents module in the authenticated browser workspace and wired the
  browser bridge/store to the server inventory.
- Preserved per-user built-in overrides, custom Agents, disabled IDs, legacy
  custom roots, and identity preferences in Web settings and sync snapshots.
- Administrators receive shallow server-host root detection; non-admin users
  receive logical-only inventory without filesystem probes.
- Disabled Provider, config, session, usage, maintenance, launch, asset, and
  filesystem mutation surfaces through truthful capability responses.
- Bounded inventory to the canonical built-ins plus 32 custom Agents and added a
  five-second, 256-entry root-existence cache. The existing virtualized sidebar
  remains the list presentation boundary.

## Verification

- `pnpm --filter @prompthub/web test`: 63 files and 380 tests passed.
- Focused V8 coverage for `routes/agents.ts` and
  `agent-inventory.service.ts`: 100% lines, statements, functions, and branches.
- `pnpm --filter @prompthub/web typecheck`: passed.
- `pnpm --filter @prompthub/web lint`: passed.
- `pnpm --filter @prompthub/web build`: client and server builds passed. The
  existing large authenticated workspace chunk warning remains; the route stays
  lazy-loaded and this change does not add recursive inventory work.
- Desktop Web-runtime regression set: 4 files and 20 tests passed.
- `pnpm --filter @prompthub/desktop typecheck`: passed.
- `pnpm --filter @prompthub/desktop lint`: passed.
- Boundary coverage includes unauthenticated access, per-user isolation,
  administrator/non-administrator host detection, malformed legacy settings,
  cache reuse/eviction, 32-custom-Agent inventory, stable route failure, bridge
  dispatch, navigation restoration, and disabled native asset calls.

## Analyze

- Traceability complete for the initial slice.
- Conflicts/blockers resolved: yes; deep native features remain explicitly deferred.
- No database migration, Agent filesystem mutation, Provider/session exposure,
  or connected-device RPC was introduced.

## Converge

- Stable Web behavior synchronized in `spec/knowledge/behavior/web.md`.
- Server-host ownership decision recorded in
  `spec/adr/ADR-20260801-001-web-agent-server-host-inventory.md`.
- Implementation, verification, and documented capability boundaries agree.
- Final change destination:
  `spec/changes/archive/2026/08/2026-08-01-web-agent-management/`.

## Follow-ups

- Deep config, Provider, session, usage, launch, maintenance, and connected-device
  parity require separate ownership, authorization, secret-custody, and audit
  changes.
