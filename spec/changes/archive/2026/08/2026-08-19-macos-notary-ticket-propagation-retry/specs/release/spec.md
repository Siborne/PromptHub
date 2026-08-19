# macOS Release Retry Delta

## Added Requirements

### `FR-MACNOTARY-001`: Retry delayed Apple ticket propagation

When Apple accepts notarization but the ticket is temporarily unavailable to
stapler, the macOS packaging job MUST retry after a bounded delay instead of
immediately cancelling the release matrix.

#### Scenario: Ticket is not yet visible

- **Given** notarization reports success
- **And** stapler reports `Record not found`, no base64 ticket, or Error 65
- **When** the packaging attempt fails
- **Then** the workflow waits before retrying signing/notarization packaging
- **And** all later signing, stapling, and Gatekeeper gates remain required

#### Scenario: Failure is not classified as transient

- **Given** packaging fails for any other reason
- **Then** the workflow immediately fails with the original status
- **And** does not consume the retry budget to hide the defect

### `NFR-MACNOTARY-001`: Bounded external retry

The workflow MUST make at most three total packaging attempts, use a fixed
60-second delay, and clean only the current job's macOS output between attempts.
