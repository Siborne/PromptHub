# Design

<!-- traceability: enforced -->

## Corrected Boundary

This change concerns the **self-hosted Web distribution**. It does not add a
cloud account model, connected-device RPC, or a new per-user Agent database
scope.

Web and Desktop have service parity. Their transport and native adapters differ:

```text
Desktop renderer -> preload/IPC -> Electron main adapter -> shared core/DB
Web renderer     -> browser bridge -> Hono route -> server adapter -> shared core/DB
```

## `DES-WEB-AGENT-PARITY-001`: Shared And Web-Specific Layers

### Shared

- Agent platform catalog, identities, capabilities, and serializable contracts
  in `packages/shared`.
- Agent orchestration, normalization, validation, reconciliation, aggregation,
  backup/redaction, and adapter interfaces in `packages/core`.
- Agent persistence primitives and migrations in `packages/db`.
- Agent renderer shell, navigation, cards, editors, lists, status components,
  selectors, and stores where they depend only on public contracts.

### Desktop-specific

- Electron IPC/preload transport.
- Native dialogs, tray, window controls, OS shell launch, and application launch.
- Direct installation/distribution to the Desktop machine.
- Electron-only secure storage and process integration.

### Self-hosted Web-specific

- Authenticated Hono route transport.
- Server runtime path resolution and server-safe filesystem/process adapters.
- HTTP upload/download/export responses instead of native save/open dialogs.
- Explicit unavailable results for operations that only make sense on the
  browser viewer's local machine.

## `DES-WEB-AGENT-PARITY-002`: Service Matrix

| Service             | Shared behavior                                              | Self-hosted Web difference                                                               |
| ------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Overview / settings | inventory, identity, capabilities, paths, preferences        | server runtime status; no browser-local detection                                        |
| Skills              | library, detail, versions, safety, import/export             | no install into viewer's local Agent; export/download instead                            |
| MCP                 | library, market, configuration metadata, validation          | no direct projection into viewer's local config                                          |
| Plugins             | library, package detail, versions, source/update metadata    | no direct distribution into viewer's local Agent                                         |
| Rules               | list, edit, versions, rewrite, project metadata              | server-managed rules only; no browser-local file projection                              |
| Definitions         | list, preview, validation, export                            | no native editor launch; browser preview/download                                        |
| Provider            | profiles, models, test, import/export, redacted state        | server-side secret custody; native activation only when server adapter supports it       |
| Appearance          | theme/Pet library, preview, import/export                    | no Electron skin host; apply/restore only when server runtime supports it                |
| Config Files        | bounded tree, redacted read, validation, revision-safe write | server Agent root only; no browser-local paths or native open-folder action              |
| Sessions            | list, search, paged transcript, annotations, export          | server Agent sessions; resume/continue adapted to copy/export when launch is unavailable |
| Usage               | normalized quota/status model                                | server-side probe only; always show source and freshness                                 |
| Maintenance         | roots, version, permissions, adapter state, diagnostics      | no native application launch; install/update only when an audited server adapter exists  |

## `DES-WEB-AGENT-PARITY-003`: Service Contracts Before Routes

Renderer components must not branch into duplicate Web business logic. Each
domain exposes a public service contract. Desktop adapts it to IPC; Web adapts
it to HTTP. Platform-specific parsing and mutation move out of Electron-only
orchestration when Web needs the same behavior.

The browser bridge mirrors the Desktop `window.api.agent` surface for supported
services. Methods that have a Web expression call `/api/agents/...`; methods
that are inherently native return a typed unavailable result or are represented
as disabled actions before invocation.

## `DES-WEB-AGENT-PARITY-004`: Data And Storage

Use the self-hosted Web deployment's existing SQLite, runtime directories,
settings files, and synchronized Agent asset snapshots. Do not introduce a
second Web-only copy of Agent business data merely to satisfy the UI.

- Existing Web Skill and Rules services remain their domain owners.
- Existing MCP/Plugin synchronized libraries are promoted through their owning
  Web service APIs before the Agent page consumes them.
- Provider/session DB primitives remain owned by `packages/db`; server routes
  use those primitives through shared services.
- Appearance/config/session files resolve under server runtime helpers and
  remain subject to the same path, symlink, size, redaction, backup, and rollback
  rules as Desktop-capable adapters.
- Web Provider credentials and Config rollback backups use AES-256-GCM through
  the shared encryption boundary. The deployment supplies a stable 32-byte
  `AGENT_SECRET_KEY`; absence or malformed input disables secret/config writes.
  JWT secrets and plaintext fallbacks are not accepted as encryption keys.
- Web Session pages read the shared index first. Until a native transcript
  adapter is extracted for a platform, detail responses contain only the
  indexed redacted preview and explicitly report truncation instead of reading
  arbitrary `sourcePath` files.

This change does not add `local`, `user:<id>`, or `runtime:<id>` scope columns.

## `DES-WEB-AGENT-PARITY-005`: Browser Action Adaptation

| Desktop action                     | Web action                                                            |
| ---------------------------------- | --------------------------------------------------------------------- |
| Native open/save dialog            | upload, inline editor, or HTTP download                               |
| Install Skill to local Agent       | export/download or server-side install only when explicitly supported |
| Distribute Plugin/MCP/Rule locally | export/download or audited server projection                          |
| Launch Agent application           | unavailable with explanation; never fake success                      |
| Resume session by launching Agent  | copy/export continuation payload unless a server adapter can resume   |
| Tray/window action                 | omitted from Web chrome, not from Agent service pages                 |

## `DES-WEB-AGENT-PARITY-006`: Performance And Security

- Initial Agent page load performs no recursive config/session scan.
- Config/session endpoints enforce path, byte, line, page, and concurrency caps.
- Server probes use bounded caches and fixed executable arguments without a shell.
- Route errors expose stable codes, not raw paths, environment values, command
  output, tokens, or stack traces.
- Native mutation retains preview, expected revision/digest, backup, atomic
  replace, verification, and rollback.
- The extracted Config service keeps its cohesive containment validator and
  queued write factory above the default 50-line guideline because splitting
  the ordered lstat/realpath/revision/backup/verify/rollback sequence would
  obscure the security invariant. Seventeen adversarial Config tests cover the
  path, secret, format, concurrency, verification, and rollback branches.

## Analyze Result

- The current Web bridge exposes only `agent.listManaged`, so most Desktop Agent
  components cannot be enabled safely yet.
- More than fifty Desktop Agent operations are grouped across Provider,
  Appearance, Config, Definitions, Sessions, Conversation, Usage, Maintenance,
  backup, launch, and lifecycle domains.
- Several reusable workflows currently live under Electron main and must be
  split into shared orchestration plus Desktop/Web adapters.
- Web already has Skill and Rules services and synchronized MCP/Plugin data;
  those should be reused rather than rebuilt inside the Agent UI.
- No new data ownership model or connected-device design is required.

## Traceability

| Requirement                | Design                                                        | Verification                                                    | Task                                                      |
| -------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------- |
| `FR-WEB-AGENT-PARITY-001`  | `DES-WEB-AGENT-PARITY-001`, `DES-WEB-AGENT-PARITY-002`        | `TEST-WEB-AGENT-PARITY-001`                                     | `T-WEB-AGENT-PARITY-001`, `T-WEB-AGENT-PARITY-005`        |
| `FR-WEB-AGENT-PARITY-002`  | `DES-WEB-AGENT-PARITY-001`, `DES-WEB-AGENT-PARITY-003`        | `TEST-WEB-AGENT-PARITY-002`                                     | `T-WEB-AGENT-PARITY-002`, `T-WEB-AGENT-PARITY-003`        |
| `FR-WEB-AGENT-PARITY-003`  | `DES-WEB-AGENT-PARITY-002`, `DES-WEB-AGENT-PARITY-005`        | `TEST-WEB-AGENT-PARITY-003`, `TEST-WEB-AGENT-PARITY-005`        | `T-WEB-AGENT-PARITY-003`, `T-WEB-AGENT-PARITY-005`        |
| `FR-WEB-AGENT-PARITY-004`  | `DES-WEB-AGENT-PARITY-002` through `DES-WEB-AGENT-PARITY-006` | `TEST-WEB-AGENT-PARITY-004` through `TEST-WEB-AGENT-PARITY-007` | `T-WEB-AGENT-PARITY-003` through `T-WEB-AGENT-PARITY-006` |
| `FR-WEB-AGENT-PARITY-005`  | `DES-WEB-AGENT-PARITY-003`, `DES-WEB-AGENT-PARITY-005`        | `TEST-WEB-AGENT-PARITY-005`                                     | `T-WEB-AGENT-PARITY-004`, `T-WEB-AGENT-PARITY-005`        |
| `FR-WEB-AGENT-PARITY-006`  | `DES-WEB-AGENT-PARITY-004`, `DES-WEB-AGENT-PARITY-006`        | `TEST-WEB-AGENT-PARITY-006`                                     | `T-WEB-AGENT-PARITY-004`, `T-WEB-AGENT-PARITY-006`        |
| `NFR-WEB-AGENT-PARITY-001` | `DES-WEB-AGENT-PARITY-006`                                    | `TEST-WEB-AGENT-PARITY-007`                                     | `T-WEB-AGENT-PARITY-006`                                  |
