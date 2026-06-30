# Desktop Prompt Copy Variable Fallback Spec

## Added Requirements

### Requirement: Empty Copy Variable Fallback

When copying a prompt from the desktop variable input modal, PromptHub MUST replace an empty user-variable field with that variable's name.

#### Scenario: Copy Prompt With Empty Variable Field

- GIVEN a prompt contains `{{topic}}` and `{{audience}}`
- AND the user fills only `topic`
- WHEN the user copies the filled prompt
- THEN `topic` is replaced with the entered value
- AND `audience` is replaced with `audience`
- AND the copied text does not contain the unresolved `{{audience}}` placeholder.
