# Proposal

## Phase And Status

- Phase: converge
- Status: review-pending
- Primary requirements: `FR-DESKTOP-DEV-001`, `FR-DESKTOP-DEV-002`

## Problem

The Desktop Vite server currently binds through `localhost`. On macOS, another
application can already own `127.0.0.1:5173` while PromptHub successfully binds
`[::1]:5173`. Electron then loads `http://localhost:5173`, so separate document,
module, and HMR connections can resolve to different applications. The observed
result is a PromptHub renderer error-boundary screen even though the database and
Electron main process remain healthy.

## Scope

- Pin the PromptHub Desktop development server to IPv4 loopback.
- Let Vite select the next free port when the preferred port is occupied.
- Keep the main-process fallback URL on the same loopback family.
- Add a regression guard for the development lifecycle configuration.

Production builds, user data, database behavior, and unrelated development
servers are out of scope.

## Development Restart Follow-up

When a main-process source file changes, `vite-plugin-electron` terminates the
current Electron child and immediately spawns its replacement. On macOS the old
process can still own the single-instance lock while the replacement starts.
The replacement then exits, and the plugin's child-exit handler terminates Vite,
returning the developer to the shell. Shutdown window events can also refresh
the tray after the database has closed, producing a misleading SQLite error.

The development lifecycle must wait for the owned Electron child to exit before
starting its replacement, without touching unrelated processes. Visibility and
tray publication must stop once application shutdown begins.

## Risk And Rollback

The change affects development mode only. Vite continues to expose the selected
URL through `VITE_DEV_SERVER_URL`; reverting restores the ambiguous dual-stack
binding. No user process or occupied port may be terminated to make port 5173
available.
