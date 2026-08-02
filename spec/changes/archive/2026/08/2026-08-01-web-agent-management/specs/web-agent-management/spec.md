# Delta Spec

## Added Requirements

- `FR-WEB-AGENT-001`: Authenticated Web users can manage Agents only after the server declares which machine is managed and which Agent capabilities are authorized for that user.
- `FR-WEB-AGENT-002`: Web Agent inventory reuses canonical built-in/custom identities and capability states; it must not create a separate Agent catalog or report unsupported native operations as successful.
- `FR-WEB-AGENT-003`: Agent paths, provider data, secrets, sessions, and mutations have one explicit owner and isolation key. Browser, server-host, and connected-device state must not be mixed.
- `NFR-WEB-AGENT-001`: List/search endpoints use bounded inventory work; session/config access is opt-in, paginated/size-limited, validated, and denied by default.
- `FR-WEB-AGENT-004`: Portable Web/Desktop sync preserves all logical Agent settings accepted by the Web settings API.

## Clarification Scenarios

- `TEST-WEB-AGENT-001`: A user cannot read or mutate another user's Agent preferences or device-scoped Agent records.
- `TEST-WEB-AGENT-002`: A Web capability response identifies the managed target as `server-host`, `connected-device`, or `logical-only` and disables every non-real tab/action.
- `TEST-WEB-AGENT-003`: Paths and native operations are rejected when the selected ownership model does not authorize filesystem access.
- `TEST-WEB-AGENT-004`: Large inventories and repeated search/filter requests stay within a documented time/memory budget and do not recursively scan session/config trees.
- `TEST-WEB-AGENT-005`: Desktop-format snapshots round-trip built-in overrides, custom Agents, disabled IDs, legacy custom roots, and identity preferences through Web normalization.
