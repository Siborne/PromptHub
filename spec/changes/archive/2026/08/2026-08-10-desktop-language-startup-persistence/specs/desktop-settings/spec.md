# Desktop Settings Delta

## Requirements

- `FR-LANG-001`: An explicitly persisted renderer language MUST remain the
  renderer startup preference and MUST be synchronized to main-process
  settings for backward compatibility.
- `FR-LANG-002`: When renderer persistence contains no language, the renderer
  MUST apply the validated language returned by main-process settings.
- `FR-LANG-003`: A renderer default created only because persistence is absent
  MUST NOT overwrite the main-process language before settings are loaded.
- `FR-LANG-004`: Malformed renderer persistence MUST be treated as absent and
  MUST NOT block startup.

## Scenarios

### Existing renderer preference

Given renderer persistence contains `de` and main settings contain `zh`, when
startup settings are merged, the renderer remains `de` and synchronizes that
explicit preference to main settings.

### Renderer persistence missing

Given renderer persistence contains no language and main settings contain
`zh`, when startup settings are merged, the renderer switches to `zh` and
persists it for later launches.

### Temporary default

Given renderer persistence contains no language, when Zustand hydration
finishes before main settings are loaded, the main synchronization payload does
not contain `language`.
