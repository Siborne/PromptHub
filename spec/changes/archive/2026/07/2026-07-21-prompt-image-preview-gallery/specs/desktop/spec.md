# Desktop Prompt Image Preview Gallery Delta

## `FR-PIP-001`: Continuous Prompt Image Preview

Desktop MUST let users move through the current Prompt's saved images without closing
the large-image preview. The gallery MUST preserve the Prompt image array order and open
at the clicked image.

### Scenario: Navigate a multi-image Prompt

- Given a Prompt contains multiple saved images
- When the user opens any image in the large preview
- Then that image is displayed with its one-based position and total image count
- And previous and next controls are visible
- And controls are disabled at the first and last image rather than wrapping
- And `ArrowLeft` and `ArrowRight` perform the same bounded navigation
- And `Escape` continues to close the preview

### Scenario: Preview one image

- Given only one image belongs to the preview context
- When the large preview opens
- Then navigation controls and the position indicator are not rendered

### Scenario: Preview temporary output

- Given a temporary AI response image is not part of the Prompt's saved images
- When it opens in the shared preview
- Then it remains an isolated single-image preview
- And saved Prompt images are not silently mixed into that context

## `NFR-PIP-001`: Accessible And Bounded Interaction

Navigation controls MUST expose localized accessible names, keep stable screen positions,
and remain operable by mouse and keyboard. Gallery derivation may scan the Prompt image
array once when inputs change (`O(n)` time and space); each navigation action MUST remain
`O(1)` and MUST NOT issue additional application-level I/O.

## Traceability

| Requirement   | Design        | Verification   | Task        |
| ------------- | ------------- | -------------- | ----------- |
| `FR-PIP-001`  | `DES-PIP-001` | `TEST-PIP-001` | `T-PIP-001` |
| `NFR-PIP-001` | `DES-PIP-002` | `TEST-PIP-002` | `T-PIP-002` |
