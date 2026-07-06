# Design

## Ownership

- Shared contract: `packages/shared/types/settings.ts`
- Renderer source of truth: `apps/desktop/src/renderer/stores/settings.store.ts`
- Settings UI: `apps/desktop/src/renderer/components/settings/NetworkSettings.tsx`
- Main-process application point:
  `apps/desktop/src/main/services/network-proxy.ts`
- Main-process settings sync hook:
  `apps/desktop/src/main/ipc/settings.ipc.ts`

## Data Contract

Add `Settings.networkProxy?: NetworkProxySettings`.

The desktop renderer stores a normalized `networkProxy` object directly and
syncs that object to main whenever the user changes proxy settings. The UI is
exposed as a top-level Desktop Settings page instead of living inside General
Settings, because proxy settings are shared by multiple network workflows.

The existing `useUpdateMirror` setting remains unchanged as the source of truth
for update mirror fallback. Its control is rendered in the same Network Settings
page because it selects an alternate network source.

## Proxy Modes

- `system`: Electron session uses system proxy. Node/Git preserve startup
  process environment values.
- `direct`: Electron session uses direct mode. Node/Git restore startup process
  environment values.
- `manual`: Electron session uses `fixed_servers`. Node-owned HTTP(S) request
  helpers use proxy agents. Git child processes inherit manual proxy
  environment variables.

The main process applies the stored proxy setting immediately after database
initialization during startup, before renderer creation, updater initialization,
or user-triggered network IPC calls. Renderer settings load/save re-applies the
same normalized setting so startup and UI edits share one path.

## Network Coverage

Covered in this change:

- Electron renderer/session traffic
- Skill remote content fetch helpers
- MCP remote content fetch, because it delegates to SkillInstaller
- Plugin marketplace fetches via injected main-process fetch function
- Git commands spawned by Skill and Plugin import helpers
- AI HTTP IPC requests for HTTP/HTTPS and SOCKS5 proxy modes
- S3 sync requests via AWS SDK `NodeHttpHandler`
- Updater-owned GitHub preview lookup and macOS direct DMG downloads
- Update mirror fallback configuration, using the existing `useUpdateMirror`
  settings field

Tracked limitation:

- SOCKS5 is applied to Node HTTP(S) request helpers through `socks-proxy-agent`.
  Main-process fetch/streaming paths use a Node HTTP(S) fetch bridge for SOCKS5
  and undici `ProxyAgent` for HTTP/HTTPS proxy modes.
- `electron-updater` internal update downloads remain best-effort through
  Electron session proxy/environment behavior where the library owns the
  transport. PromptHub-owned updater calls use explicit proxy agents.

## Security

Manual proxy passwords are persisted in the existing settings path. This matches
current WebDAV/S3/AI credential behavior and is called out as follow-up debt for
safeStorage migration.
