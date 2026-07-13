# Tasks

- [x] `T-ZCODE-001` Add the ZCode platform registry entry and Rules metadata.
- [x] `T-ZCODE-002` Add nested ZCode MCP JSON projection/import helpers.
- [x] `T-ZCODE-003` Add global and project ZCode MCP target presets.
- [x] `T-ZCODE-004` Preserve the evidence-limited Plugin boundary and update
  platform reference docs.
- [x] `T-ZCODE-005` Run focused tests, typecheck/build checks, and record issue
  delivery status.

## Verification Methods

- `TEST-ZCODE-001`: black-box platform root, Skills, and Rules path tests.
- `TEST-ZCODE-002`: target JSON build/merge/remove tests with unrelated keys.
- `TEST-ZCODE-003`: core target preset and import-state tests.
- `TEST-ZCODE-004`: Plugin matrix/documentation assertions that no unverified
  ZCode package target is enabled.
