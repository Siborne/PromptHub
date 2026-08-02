# Proposal

## Phase And Status

- Phase: converge
- Status: implemented and verified
- Primary requirement: `FR-WEB-AGENT-001`
- Exit condition: Web exposes truthful Agent inventory and user-scoped logical management without exposing unowned native state.

## Why

The Web client embeds the Desktop renderer but intentionally hides the Agents module. The current Agent workbench assumes direct access to a machine's Agent roots, native configuration, executables, sessions, provider secrets, and applications. A browser has no such local access, while the self-hosted Web server may run on a different machine and may serve multiple users. Web Agent management therefore needs an explicit managed-machine and ownership contract rather than a bridge that fabricates Desktop success.

## Scope

- In scope:
  - Expose an authenticated Web Agent management surface aligned with the chosen managed-machine model.
  - Reuse shared platform identities, capability truth, settings normalization, and `packages/core` inventory logic.
  - Add server routes/services and browser bridge methods only for capabilities that are real in the chosen runtime.
  - Preserve unsupported/partial capability labels for functionality that is not implemented.
- Out of scope for this slice:
  - Recursive server filesystem scans, config mutation, secret handling, session access, executable update, or application launch.
  - Reusing Desktop-only IPC handlers from Web.
  - Treating browser paths as connected-Desktop paths. Admin inventory paths refer only to the self-hosted server process account.

## Selected Boundary

- Administrators receive bounded, read-only Agent root detection for the self-hosted server host.
- Non-admin users receive a logical-only inventory and never trigger arbitrary server path existence checks.
- Built-in overrides, custom Agents, disabled IDs, and identity preferences remain per-user settings.
- The Web capability response downgrades every Desktop-native operation to unsupported; only overview and logical settings management are enabled.

## Risks

- Server-host paths are shared machine state while current Web settings are per-user; independent user overrides could target or mutate the same runtime inconsistently.
- Existing Agent provider/profile tables and native backups were designed for a device-local Desktop database and do not yet define multi-user ownership.
- Exposing native configuration, transcripts, credentials, or command/update operations over HTTP expands the trust boundary substantially.
- A connected-Desktop design requires device authentication, online state, request authorization, replay protection, and remote execution auditing.

## Rollback Thinking

Keep the Web runtime capability disabled until the selected backend contract and tests land together. Any future rollout should be guarded by an explicit server capability response so the client can return to Prompt without stale navigation.

## Related Records

- Issue: none
- ADR: `spec/adr/ADR-20260801-001-web-agent-server-host-inventory.md`
- Stable workflow/knowledge docs: `spec/knowledge/behavior/web.md`, `spec/knowledge/reference/agent-platforms.md`, `spec/changes/active/agent-management-workbench/`
