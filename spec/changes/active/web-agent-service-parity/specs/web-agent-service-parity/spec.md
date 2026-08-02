# Delta Spec

## Requirements

- `FR-WEB-AGENT-PARITY-001`: Self-hosted Web exposes the same Agent service
  domains and stable navigation as Desktop.
- `FR-WEB-AGENT-PARITY-002`: Web and Desktop reuse shared Agent contracts,
  business services, persistence primitives, and UI components; only transport
  and native adapters differ.
- `FR-WEB-AGENT-PARITY-003`: Skills, MCP, Plugins, Rules, and Definitions remain
  usable Web services even when installation or direct distribution is not
  available from the browser.
- `FR-WEB-AGENT-PARITY-004`: Provider, Appearance, Config, Sessions, Usage, and
  Maintenance expose Web APIs and a usable Web presentation for the
  self-hosted server runtime.
- `FR-WEB-AGENT-PARITY-005`: Browser-inapplicable operations use a truthful
  alternate action or unavailable state without hiding the owning service.
- `FR-WEB-AGENT-PARITY-006`: Web never treats browser-local paths as server
  paths and never exposes secrets, unrestricted filesystem access, or raw
  native errors.
- `NFR-WEB-AGENT-PARITY-001`: Agent list, asset, session, config, and diagnostic
  endpoints are bounded, paginated where needed, and avoid recursive scans on
  initial page load.

## Acceptance Criteria

- `AC-WEB-AGENT-PARITY-001`: Web shows Overview, Skills, MCP, Plugins, Rules,
  Definitions where applicable, Provider, Appearance, Config Files, Sessions,
  Usage, and Maintenance in the same product structure as Desktop.
- `AC-WEB-AGENT-PARITY-002`: Web Agent services call HTTP routes backed by the
  same shared business contracts used by Desktop rather than duplicating logic
  in React.
- `AC-WEB-AGENT-PARITY-003`: Install, distribute, native launch, tray, and local
  file-dialog actions are disabled or adapted without disabling the whole page.
- `AC-WEB-AGENT-PARITY-004`: Server-side Agent data is read and changed only
  through validated server adapters and existing deployment authorization.

## Verification Scenarios

- `TEST-WEB-AGENT-PARITY-001`: The Web Agent shell exposes every stable service
  domain in the Desktop order.
- `TEST-WEB-AGENT-PARITY-002`: Shared service contract tests run against both an
  Electron adapter and a Web/server adapter fixture.
- `TEST-WEB-AGENT-PARITY-003`: Web can browse and manage Skill, MCP, Plugin,
  Rules, and Definition data while install/distribute actions never invoke local
  IPC.
- `TEST-WEB-AGENT-PARITY-004`: Provider, Appearance, Config, Sessions, Usage,
  and Maintenance route responses are bounded, redacted, and actionable.
- `TEST-WEB-AGENT-PARITY-005`: Unsupported native actions return stable action
  states and never fabricated success.
- `TEST-WEB-AGENT-PARITY-006`: Traversal, symlink, oversized payload, secret,
  unauthenticated, and raw-error cases are rejected at Web route boundaries.
- `TEST-WEB-AGENT-PARITY-007`: Large asset/session inventories remain within
  documented time and memory bounds.
