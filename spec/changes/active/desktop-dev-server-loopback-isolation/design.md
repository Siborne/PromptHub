# Design

<!-- traceability: enforced -->

## `DES-DESKTOP-DEV-001`: Explicit IPv4 loopback

Set the root Vite server host for `apps/desktop` to `127.0.0.1`, retain preferred
port `5173`, and explicitly keep `strictPort: false`. When that IPv4 endpoint is
occupied, Vite increments to a free port and `vite-plugin-electron` supplies the
actual origin through `VITE_DEV_SERVER_URL`.

`vite-plugin-electron` normalizes loopback hosts back to `localhost`. Before it
starts Electron, pass that controlled URL through a pure normalizer that restores
`127.0.0.1` while preserving the selected protocol, port, and path. This keeps
document, module, and HMR requests on the same address family even if another
application owns the same port number on IPv6.

Change the main-process development fallback from `localhost` to
`127.0.0.1`. The fallback is used only when the plugin-provided URL is absent.
No port probing, process termination, retry loop, or second server is added.

Startup remains `O(1)` aside from Vite's bounded port selection. Runtime CPU,
memory, database I/O, and network fan-out are unchanged.

## Verification

- `TEST-DESKTOP-DEV-001`: the development lifecycle regression proves the
  renderer host is explicit IPv4 loopback, port fallback remains enabled, and
  the main-process fallback uses the same address family.
- The URL normalizer unit test covers absent input, plugin-produced `localhost`,
  and an already explicit IPv4 URL with 100% statement, branch, function, and
  line coverage.
- Manual runtime verification proves the existing foreign IPv4 listener remains
  alive while PromptHub moves to another IPv4 port and renders its normal UI.

## `DES-DESKTOP-DEV-002`: Ordered Electron child restart

Before `onstart` invokes the plugin startup function, a small development-only
helper inspects `process.electronApp`. If the owned child is still running, the
helper removes the plugin's `exit -> process.exit` listener, subscribes to the
child exit event, terminates that exact process tree through the plugin's public
`treeKillSync` helper, and waits at most five seconds. Startup proceeds only
after the previous child has been reaped, preventing a single-instance-lock
race. A timeout fails that rebuild explicitly rather than spawning a second
competing process, while the Vite boundary catches and reports the failure.

Main bundle watches can finish more than once for one save burst. A coordinator
stored on the long-lived Vite process survives configuration reloads, serializes
restart work and coalesces queued callbacks to the latest bundle generation. A
failed restart is logged at the Vite boundary and leaves the renderer server
alive so a later rebuild can recover; it is not allowed to become an unhandled
rejection that exits the development command.

Main-process visibility publication returns immediately once `isQuitting` is
set. Database closure and all existing production quit behavior remain
unchanged. Restart work is O(P) in the owned Electron process-tree size, uses
constant application memory, performs no network or database I/O, and creates
no polling loop.

## Traceability

| Requirement          | Design                | Verification           | Task                                                          |
| -------------------- | --------------------- | ---------------------- | ------------------------------------------------------------- |
| `FR-DESKTOP-DEV-001` | `DES-DESKTOP-DEV-001` | `TEST-DESKTOP-DEV-001` | `T-DESKTOP-DEV-001`, `T-DESKTOP-DEV-002`, `T-DESKTOP-DEV-003` |
| `FR-DESKTOP-DEV-002` | `DES-DESKTOP-DEV-002` | `TEST-DESKTOP-DEV-002` | `T-DESKTOP-DEV-004`, `T-DESKTOP-DEV-005`, `T-DESKTOP-DEV-006` |
