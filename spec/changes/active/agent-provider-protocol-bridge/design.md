# Agent Provider Protocol Bridge Design

## `DES-PROTOCOL-001`: Route Planning Before Persistence

One shared planner receives the upstream provider protocol, the selected Agent,
and the Agent's native wire protocols. It returns either a direct route, a
bridged route with explicit inbound and outbound protocols, or an unsupported
result with a stable reason. The list, preview, import, activation, and test
paths MUST consume the same plan.

The four canonical protocols are:

| ID | Display name |
| --- | --- |
| `openai-chat` | OpenAI Chat |
| `openai-responses` | OpenAI Responses |
| `anthropic-messages` | Anthropic Messages |
| `google-generative-ai` | Google Generative AI |

Native adapter evidence remains authoritative. Kimi currently has verified
native provider kinds for all four. Codex, Claude, Gemini, Grok, OpenCode, Pi,
and Qwen retain their existing verified direct subsets. A missing native subset
is not expanded by changing a label or endpoint.

## `DES-PROTOCOL-002`: Main-Process Bridge Boundary

The bridge lives under the Desktop main-process service boundary and exposes no
raw credential or request-body API to the renderer. It binds only to an
ephemeral loopback port, authenticates every Agent request with a generated
device-local token, accepts only registered active route IDs, and resolves the
upstream credential from main-process secret storage at request time.

The runtime uses bounded request and response sizes, a bounded number of
concurrent streams, abort propagation, connect/request/idle timeouts, and no
automatic retry for non-idempotent model requests. Logs contain route IDs,
protocols, timing, byte counts, and sanitized error codes only.

## `DES-PROTOCOL-003`: Conversion Modules

Conversion is split by canonical message/event representations rather than six
pairwise ad-hoc converters:

1. Parse the Agent wire request into a validated canonical request.
2. Validate feature preservation for the upstream protocol.
3. Encode the upstream request and authorization headers.
4. Decode streaming or non-streaming upstream output into canonical events.
5. Encode canonical events back to the Agent wire protocol.

Each protocol module owns request parsing, response encoding, streaming event
translation, finish reasons, tools, usage, errors, and adversarial fixtures.
Unknown fields are not blindly forwarded across trust boundaries.

## `DES-PROTOCOL-004`: Delivery Sequence

Delivery is split into reversible batches:

1. Canonical protocol vocabulary, native capability matrix, and UI omissions.
2. Route planner and preview contract, with bridged choices still unavailable.
3. Loopback lifecycle and authenticated route registration.
4. Protocol codecs with black-box and fixture-based tests.
5. Activation integration, failure recovery, stress tests, and UI enablement.

No batch may expose a bridged protocol as selectable before the corresponding
runtime and verification gate pass.

## Affected Areas

- Data model: route mode and bridge metadata in Provider Profiles; migration is
  required before persistence changes land.
- IPC / API: typed route preview, lifecycle status, activation, and diagnostics.
- Filesystem / sync: non-secret profile metadata may sync; tokens, ports,
  credentials, runtime state, and request data remain device-local.
- UI / UX: canonical names, direct/bridged badges, explicit preview, unavailable
  reasons, and bridge lifecycle status.

## Tradeoffs

- A canonical intermediate form avoids `O(P^2)` pairwise converters as protocol
  count grows, at the cost of stricter validation and protocol-specific codecs.
- Loopback routing is more complex than native projection but is the only honest
  way to support non-native Agent/protocol combinations.
- No persistent traffic log is added; observability is intentionally less rich
  than a debugging proxy to protect local prompts and credentials.

## Failure And Rollback

- External boundary: loopback listener and upstream provider network.
- Partial failure behavior: activation rolls back the Agent-native file if route
  registration or verification fails; an in-flight stream is aborted and its
  owned resources are released.
- Recovery/rollback: stop the bridge, restore the last verified native backup,
  and keep the Profile with an unavailable diagnostic for repair.

## Analyze Result

- Requirement links: `FR-PROTOCOL-001` through `FR-PROTOCOL-004`.
- Verification links: `TEST-PROTOCOL-001` through `TEST-PROTOCOL-004`.
- Blocking conflicts: none after the user explicitly required all four
  protocols; this change preserves the existing separate-capability gate.
- Unresolved `[待确认]`: none for the design boundary. Runtime implementation
  remains gated by the tasks below.

## Traceability

| Requirement | Design | Verification | Task |
| --- | --- | --- | --- |
| `FR-PROTOCOL-001` | `DES-PROTOCOL-001` | `TEST-PROTOCOL-001` | `T-PROTOCOL-001` |
| `FR-PROTOCOL-002` | `DES-PROTOCOL-001` | `TEST-PROTOCOL-002` | `T-PROTOCOL-002` |
| `FR-PROTOCOL-003` | `DES-PROTOCOL-003` | `TEST-PROTOCOL-003` | `T-PROTOCOL-004` |
| `FR-PROTOCOL-004` | `DES-PROTOCOL-002` | `TEST-PROTOCOL-004` | `T-PROTOCOL-005` |
