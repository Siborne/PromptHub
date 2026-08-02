# Proposal

## Phase And Status

- Phase: plan
- Status: self-hosted Web parity boundary confirmed
- Primary requirement: `FR-WEB-AGENT-PARITY-001`
- Exit condition: the self-hosted Web build exposes the same Agent service
  domains as Desktop, with browser-inapplicable native actions adapted rather
  than entire services removed.

## Why

The first Web Agent implementation exposed inventory and settings but marked
every other Agent service as unsupported. That is too narrow. The self-hosted
Web application is another PromptHub distribution, not a separate logical-only
Agent product. It must reuse the same Agent service model as Desktop.

The deployment difference is transport and native integration: Desktop calls
Electron preload/IPC and local OS adapters; Web calls authenticated Hono APIs
and server-safe adapters. A browser cannot install a Skill onto the viewer's
machine, distribute a package directly into a local Agent, launch a desktop
application, or expose tray/window controls. Those action differences must not
remove Skills, MCP, Plugins, Rules, Provider, Appearance, Config, Sessions,
Usage, or Maintenance from Web.

## Scope

- Keep one shared Agent information architecture and service vocabulary.
- Reuse shared contracts, core business services, DB primitives, selectors, and
  renderer components where their runtime assumptions permit it.
- Add Web API adapters for all Agent service domains.
- Adapt browser-inapplicable actions to export, download, copy, server-side
  operation, or an explicit unavailable state.
- Preserve the self-hosted deployment's existing authentication and storage
  model. This change does not introduce an account cloud, device RPC, or a new
  user/runtime scoping scheme.

## Out Of Scope

- Managing the browser viewer's local filesystem from the self-hosted server.
- Connected-Desktop remote execution.
- Electron tray, native window, file-dialog, or shell-launch behavior in Web.
- Fabricated success for an action that the Web/server runtime cannot perform.

## Rollback

The existing authenticated inventory endpoint remains the fallback. Service
routes and bridge methods are additive. A server adapter can be disabled at the
action level without removing the service domain or deleting stored data.

## Related Records

- Superseded boundary:
  `spec/adr/ADR-20260801-001-web-agent-server-host-inventory.md`
- Replacement:
  `spec/adr/ADR-20260802-001-web-agent-service-parity.md`
- Desktop Agent source design:
  `spec/changes/active/agent-management-workbench/design.md`
