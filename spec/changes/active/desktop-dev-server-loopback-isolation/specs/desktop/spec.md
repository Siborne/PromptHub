# Desktop Development Server Loopback Isolation Delta

## Added Requirements

### `FR-DESKTOP-DEV-001`: One unambiguous renderer origin

PromptHub Desktop development mode MUST bind its renderer server to an explicit
loopback address and MUST use the actual Vite-selected URL in Electron.

#### Scenario: Another application owns IPv4 port 5173

- **Given** another application listens on `127.0.0.1:5173`
- **When** PromptHub Desktop development mode starts
- **Then** PromptHub selects another free IPv4 loopback port
- **And** Electron loads that exact PromptHub origin
- **And** it does not share `localhost:5173` across IPv4 and IPv6 listeners
- **And** the unrelated listener remains untouched

### `FR-DESKTOP-DEV-002`: Main-process rebuild keeps Vite alive

PromptHub Desktop development mode MUST stop and reap its current Electron child
before starting a replacement after a main-process rebuild. A replacement MUST
NOT race the previous process for the single-instance lock, and an expected
Electron restart MUST NOT terminate the owning Vite server.

Once application shutdown begins, window visibility events MUST NOT refresh the
tray or read settings from the closed application database.

#### Scenario: Main-process source changes during development

- **Given** Vite and one PromptHub Electron child are running
- **When** a main-process rebuild completes
- **Then** the plugin removes the old child exit hook
- **And** terminates only that owned Electron process tree
- **And** waits a bounded time for its exit before starting the replacement
- **And** the Vite development server remains running

#### Scenario: Window events arrive during shutdown

- **Given** application shutdown has started and the database is closed
- **When** a late show, hide, minimize or restore event arrives
- **Then** no renderer visibility message or tray refresh reads application state
