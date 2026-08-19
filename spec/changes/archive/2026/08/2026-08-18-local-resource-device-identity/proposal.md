# Local Resource Device Identity

## Why

PromptHub Desktop does not require account login for local Plugin, MCP, or Agent management. The optional renderer field `selfHostedDeviceId` belongs to self-hosted synchronization, but canonical local resource projections were still using it as a required device identity. A null sync identity could therefore block otherwise valid local libraries.

## Scope

- Decouple canonical Plugin projections, MCP bindings, and Agent device settings from optional self-hosted sync identity.
- Use the deterministic active storage-root identity for new local resource configuration documents.
- Read and re-key valid legacy Agent/MCP device documents without losing settings, bindings, secrets, or target mappings.
- Keep `getOrCreateSelfHostedDeviceId()` available only for workflows that actually require self-hosted synchronization.

## Risks And Rollback

- Existing device documents may carry UUID-based identities. Compatibility readers must validate their embedded identity before re-keying.
- Publication must remain atomic; a failed re-key must leave the original document intact.
- Rollback can restore the previous readers because migrated documents remain valid version-1 documents with unchanged business payloads.
