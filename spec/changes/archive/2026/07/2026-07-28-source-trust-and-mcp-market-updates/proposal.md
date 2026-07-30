# Source Trust And MCP Market Updates Proposal

## Why

Trusted Skill update sources are currently stored and rendered as opaque source keys. Users cannot tell which Skill or repository a trusted entry belongs to. MCP custom stores are persisted only in renderer state, so the main process cannot safely distinguish an explicitly registered self-hosted source from an arbitrary internal-network request. Installed MCP entries also lack a durable upstream template baseline, so future PromptHub Official Store and current remote catalogs cannot provide reliable update checks.

## Scope

- Render trusted Skill update sources with a readable source label, sanitized location, and matching installed Skill names while preserving the existing source key as the authorization identity.
- Persist a main-process MCP market-source allowlist and migrate current renderer custom sources into it without losing existing user configuration.
- Authorize MCP catalog fetches only when the requested URL belongs to the registered source origin/path; permit explicitly registered private-network sources without globally disabling SSRF protection.
- Add stable MCP market template identity, version/fingerprint baselines, update checks, conflict detection, and explicit update apply behavior for PromptHub Official Store, MCP Registry, and custom stores.
- Preserve PromptHub-owned MCP values such as enabled state, favorites, notes, tags, env/header secrets, and target bindings during an upstream template update.

## Non-Goals

- Automatically updating MCP entries or target files without user action.
- Treating target-config synchronization as upstream marketplace synchronization.
- Allowing arbitrary renderer-provided internal URLs that are not registered sources.
- Storing or logging URL credentials as display metadata.

## Risks And Rollback

- Existing MCP servers have no market fingerprint. Legacy entries must compare conservatively and require review when they differ from the current template.
- Existing custom MCP sources live in persisted renderer state. Migration must be additive and idempotent.
- The feature can be rolled back by ignoring optional source metadata and update fields; existing MCP library and target files remain readable.
