# Design

## Approach

- Keep `replacePromptVariables` unchanged so existing shared behavior continues to preserve `{{name}}` placeholders when no value/default exists.
- In `VariableInputModal`, derive copy-mode effective values before preview/copy:
  - non-empty field value wins
  - otherwise the variable name is used
- Keep AI test mode on the stricter existing behavior, requiring user variables to be filled before running.

## Impact

- Data model: none.
- IPC/API: none.
- Storage: no durable prompt mutation.
- UI: copy-mode button can run with empty variable fields because fallback values are available.
