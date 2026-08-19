# Design

## `DES-LOCALID-001`: One local identity source

Canonical local projections derive `device-<32 hex>` from `RuntimeStorageContext.rootIdentity`. This identity is deterministic for the active PromptHub storage root and does not change with sync configuration.

`selfHostedDeviceId` remains renderer persistence owned by self-hosted synchronization. Renderer migration stores it as null until a synchronization workflow explicitly requests one.

Canonical authority startup and complete portable export derive the local resource identity directly from their explicit active root. The canonical shadow builder rejects non-empty MCP bindings when its owner omits that identity, preventing a successful-looking checkpoint from silently dropping device bindings.

## `DES-LOCALID-002`: Compatibility readers

- Plugin projections already migrate through the journaled canonical Plugin writer.
- MCP binding reads validate the identity embedded in the binding document when no explicit portable-operation identity is supplied. Canonical writes use the local storage-root identity.
- Agent device reads validate the full legacy document against its embedded identity, then atomically republish the same payload under the local storage-root identity.
- Renderer settings hydration reads Agent configuration independently of the optional sync identity and preserves the local identity across later settings writes.

## `DES-LOCALID-003`: Complexity and safety

Identity resolution is O(1). Existing library enumeration remains O(n) in resource count; this change adds no extra resource scan. Compatibility re-key writes one bounded configuration document and uses the existing atomic publication journal.

Unsafe paths, symlinks, malformed JSON, invalid IDs, missing secret adapters, and unknown binding references continue to fail closed.

## Traceability

| Requirement       | Design                               | Verification       | Task            |
| ----------------- | ------------------------------------ | ------------------ | --------------- |
| `FR-LOCALID-001`  | `DES-LOCALID-001`, `DES-LOCALID-002` | `TEST-LOCALID-001` | `T-LOCALID-001` |
| `FR-LOCALID-002`  | `DES-LOCALID-002`                    | `TEST-LOCALID-002` | `T-LOCALID-002` |
| `NFR-LOCALID-001` | `DES-LOCALID-003`                    | `TEST-LOCALID-003` | `T-LOCALID-003` |
| `FR-LOCALID-001`  | `DES-LOCALID-001`, `DES-LOCALID-003` | `TEST-LOCALID-004` | `T-LOCALID-004` |
