# Agent Provider Protocol Bridge

## Phase And Status

- Phase: clarify / plan
- Status: active
- Primary requirement: `FR-PROTOCOL-001`
- Exit condition: PromptHub can route supported Agent provider traffic through
  OpenAI Chat, OpenAI Responses, Anthropic Messages, or Google Generative AI
  without presenting an unimplemented protocol as usable.

## Why

Provider import currently exposes only protocol combinations that the selected
Agent can write natively. That is correct for direct configuration, but it does
not meet the product requirement that the four major API protocols are
available across Agent integrations. A non-native combination needs an
explicit local protocol bridge rather than a mislabeled native profile.

## Scope

- In scope:
  - Canonical protocol identities: OpenAI Chat, OpenAI Responses, Anthropic
    Messages, and Google Generative AI.
  - A direct-versus-bridge route plan for each provider and Agent combination.
  - Main-process-only local routing with request, streaming, tool-call,
    reasoning, usage, cancellation, and error conversion.
  - Explicit lifecycle, credential custody, limits, diagnostics, and rollback.
  - Provider import and activation UI that explains whether a route is direct
    or bridged.
- Out of scope:
  - OAuth account pooling, provider failover, cost accounting, and persistent
    request-body logging.
  - Copying CC Switch's Tauri/Rust proxy as a parallel subsystem.

## Risks

- Partial conversion can silently corrupt tool calls or streamed output.
- A local listener expands the security boundary and must not expose secrets or
  accept traffic from outside the owning desktop process.
- Unbounded bodies, streams, or retries can consume excessive memory, disk, or
  network resources.

## Rollback Thinking

- Direct native profiles remain independent and continue to work when the
  bridge is disabled or unavailable.
- Disabling the bridge stops its listener and marks bridged profiles
  unavailable without rewriting Agent-native configuration silently.
- Activation keeps the existing preview, backup, verification, and rollback
  path.

## Related Records

- Existing boundary: `FR-AGENT-017` and `DES-AGENT-136` in
  `agent-management-workbench`.
- Research input: CC Switch v3.19.2, used as protocol and lifecycle evidence;
  no source or asset is copied by this change.
- Stable reference: `spec/knowledge/reference/ai-provider-apis.md`.
