# Agent Provider Protocols Delta

## Added Requirements

### `FR-PROTOCOL-001`: Four First-Class Protocols

The Agent provider domain MUST model OpenAI Chat, OpenAI Responses, Anthropic
Messages, and Google Generative AI as distinct first-class protocols.

#### Scenario: Provider uses any supported protocol

- Given a PromptHub provider uses one of the four canonical protocols
- When the user imports it for an Agent
- Then the protocol remains explicit through preview, persistence, activation,
  testing, and diagnostics
- And the UI uses the canonical protocol name rather than a provider brand or
  an ambiguous generic label

### `FR-PROTOCOL-002`: Direct And Bridged Routes Stay Distinct

PromptHub MUST use the Agent's native writer when the selected protocol is
supported directly, and MUST use an explicit local bridge route when it is not.

#### Scenario: Agent lacks the upstream protocol

- Given a provider uses Anthropic Messages
- And the selected Agent only emits OpenAI Responses natively
- When the user previews the import
- Then PromptHub identifies the route as bridged
- And the import cannot be activated until the bridge runtime is available and
  its preview has been confirmed

### `FR-PROTOCOL-003`: Conversion Is Behaviorally Complete

A bridged route MUST preserve supported text, multimodal input, system
instructions, tools, tool results, reasoning metadata, streaming deltas,
cancellation, finish reasons, usage, and bounded public errors. Unsupported
features MUST fail closed before sending a materially different request.

#### Scenario: Conversion cannot preserve a tool contract

- Given an Agent request contains a tool feature that the upstream protocol
  cannot represent safely
- When the bridge plans the request
- Then it rejects the request with a bounded protocol error
- And it does not send a degraded request to the provider

### `FR-PROTOCOL-004`: Local Bridge Security And Lifecycle

The bridge MUST remain main-process-owned, loopback-scoped, authenticated,
bounded, stoppable, and disabled unless a confirmed bridged profile requires
it. Credentials MUST remain out of renderer state, URLs, logs, exports, and
native Agent files.

#### Scenario: Bridge stops unexpectedly

- Given a bridged profile is active
- When the bridge process or listener exits
- Then the route becomes unavailable with a bounded diagnostic
- And PromptHub does not fall back to an unreviewed provider or protocol
- And all owned ports, streams, connections, and temporary files are released

## Modified Requirements

### `FR-AGENT-017`: Proxy And Failover Are Separate Capabilities

Protocol conversion remains a separately gated capability. Direct provider
switching MUST continue to function without the bridge; enabling protocol
conversion MUST NOT implicitly enable failover, traffic retention, OAuth
pooling, or cost accounting.
