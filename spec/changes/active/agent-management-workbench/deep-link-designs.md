# Agent Deep-Link Import Designs

## `DES-AGENT-061`: Versioned Provider Profile Deep Links

### Boundary

PromptHub may accept a `prompthub://import` deep link as a transport for one
portable Agent Provider Profile. The deep link is not a write API. It only
produces a bounded, non-secret preview command; the renderer must show that
preview and obtain explicit confirmation before calling the existing Provider
Profile creation service.

The first supported object type is `provider-profile`. Skill, MCP, Rule and
Plugin imports remain owned by their existing domains and are rejected until
those domains define equivalent portable, previewable contracts. Rejecting an
unknown object type is preferable to routing it through a guessed installer.

CC Switch `v3.18.0` is the workflow reference for the import affordance. The
implementation remains PromptHub-owned TypeScript over the existing Electron,
shared-contract and Provider Profile boundaries. No CC Switch runtime, schema,
screen or asset is introduced.

### Source Of Truth

- The deep link is an untrusted transport only.
- The decoded preview is transient renderer state.
- Confirmed Provider Profiles remain owned by `agent_provider_profiles`,
  `agent_provider_model_mappings` and the existing main-process Provider
  service.
- Credentials remain main-process-only secure-store data. They are not
  accepted from a process argument or URL.
- Native Agent configuration remains unchanged until the user later invokes
  the existing preview-and-activate workflow.

This batch introduces no database schema, migration, backup shape or native
Agent file-layout change.

### Wire Contract

The only accepted URL shape is:

```text
prompthub://import?payload=<percent-encoded-json>
```

The decoded JSON envelope is:

```json
{
  "version": 1,
  "objectType": "provider-profile",
  "value": {
    "version": 1,
    "profile": {
      "platformId": "codex",
      "name": "Example",
      "providerKind": "openai-compatible",
      "protocol": "openai-responses",
      "endpoint": "https://example.invalid/v1",
      "config": {},
      "source": "import"
    },
    "modelMappings": [],
    "requiresSecret": true
  }
}
```

Strict validation rejects:

- a scheme, host or path other than the exact shape above
- URL credentials, port, fragment, extra query keys or duplicate `payload`
- raw URLs above 16 KiB or decoded payloads above 12 KiB
- unknown envelope, export, profile or model-mapping keys
- unsupported versions or object types
- unknown or custom platform ids
- platforms without a verified Provider adapter
- unsupported protocols, invalid endpoints and non-public config
- more than 16 model mappings, duplicate route keys or malformed fields
- literal credentials or sensitive config keys

Valid imports force `profile.source` to `import`; the source declared by the
sender is not trusted. The parser returns either a serializable redacted
preview or a stable public error code. It never returns or logs the raw URL.

### Sensitive Values

URLs are exposed to operating-system launch services, process argument lists,
desktop history and support tooling. Therefore PromptHub deliberately applies
a stricter rule than accepting and masking an API key: a literal credential in
a deep link is detected and rejected with
`AGENT_DEEP_LINK_SENSITIVE_VALUE_REJECTED`. The UI explains that the profile
can be imported without the credential and that the credential must be added
inside PromptHub after import.

This satisfies the safety intent of `FR-AGENT-016`: the sensitive value is
never displayed, persisted, logged or forwarded to the renderer, and no Agent
configuration changes. A future credential-transfer mechanism would require a
separate threat model and must not reuse OS deep-link arguments.

### Main-Process Routing

The main process owns URL parsing and protocol registration:

- packaged desktop builds register the `prompthub` client
- development registration may pass the executable and app entry path, but
  E2E runs never mutate OS protocol registration
- macOS `open-url`, Windows/Linux second-instance arguments and initial launch
  arguments all enter the same parser
- only sanitized `AppCommand` values cross preload IPC
- commands arriving before the renderer is ready enter a FIFO queue capped at
  10 entries; oldest entries are discarded on overflow
- the queue is flushed after renderer load through the existing buffered app
  command channel

The router performs one bounded argument scan and one bounded JSON parse per
candidate. Time is `O(a + p + m)` for launch arguments, payload characters and
model mappings; space is `O(p + m)` with fixed byte and mapping caps. No
network, filesystem or database I/O occurs during parsing.

### Renderer Confirmation

The renderer navigates to the Agent workspace and opens one modal showing:

- Agent platform, profile name, provider kind and protocol
- normalized endpoint or the platform default marker
- non-secret public config and model mappings
- whether a credential is required
- an explicit statement that confirmation creates a Profile only and does not
  activate or overwrite native Agent configuration

Cancel closes the modal without IPC writes. Confirm invokes the existing
`createProviderProfile` API exactly once with `source: "import"` and no secret.
Success selects the imported platform/profile. A repeated click is disabled
while the request is active. Creation failure leaves the preview open and
shows only a stable localized error.

### Failure, Rollback And Compatibility

- Invalid input is fail-closed and has no durable side effect.
- Cancel is equivalent to rollback because no write occurred.
- Profile creation already uses the Provider service transaction and
  compensation rules; deep-link code does not add a second write path.
- The parser only accepts envelope version `1`. New versions must be additive
  parser branches with independent tests; old versions cannot silently change
  meaning.
- Unrecognized domains remain unsupported rather than partially installed.

### Verification

`TEST-AGENT-079` covers the provider-profile slice of the broader
`TEST-AGENT-015` gate:

- exact valid URL and Unicode public values
- scheme/host/path/query/version/object-type rejection
- raw and decoded size limits
- unknown keys, malformed JSON and duplicate route keys
- unsupported platform/protocol and invalid endpoint
- sensitive top-level and nested values without secret leakage
- initial, second-instance and macOS routing with a bounded queue
- preview navigation, cancel-without-write and confirm-once behavior
- no activation or native config write after import
- seven-locale copy parity and stable public errors

Traceability:

`FR-AGENT-016 -> DES-AGENT-061 -> TEST-AGENT-015 / TEST-AGENT-079 -> T-AGENT-031 / T-AGENT-116`
