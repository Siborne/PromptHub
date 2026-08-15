# Implementation

## Status

Implemented.

## Delivered

- Plugin, MCP, and Agent local projection identities are derived from the stable active storage-root identity and no longer consult renderer self-hosted synchronization state.
- Renderer persistence keeps `selfHostedDeviceId` nullable until a synchronization workflow explicitly requests one. Agent settings hydrate independently and settings writes no longer generate random Agent identities.
- Valid legacy Agent device documents are atomically re-keyed while preserving overrides, custom Agents, disabled platforms, and identity preferences.
- Valid legacy MCP binding documents remain readable through their embedded identity; the next canonical write republishes the same bindings under the local storage-root identity.
- Malformed, oversized, symlinked, and identity-mismatched documents continue to fail closed through existing schema and publication validation.

## Verification

- Focused Core tests passed: 4 files, 46 tests.
- `pnpm --filter @prompthub/core typecheck`: passed.
- `pnpm --filter @prompthub/desktop typecheck`: passed.
- Focused ESLint for changed Core source and tests: passed with zero warnings.
- `git diff --check`: passed.
