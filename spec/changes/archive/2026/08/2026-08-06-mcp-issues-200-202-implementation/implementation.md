# Implementation Record

Status: released in `0.6.0-beta.1`

The three GitHub issues were closed as completed on 2026-08-20 after the
implementation shipped in the public `0.6.0-beta.1` prerelease.

## Delivered

- `#200`: library/detail/distribution/batch target projections now use the
  merged global and registered-project target set. Agent and Project workspaces
  remain separate. Project Pi shared/native targets are selectable from My MCP.
- `#201`: added the `pi` MCP target with the shared, `.agents`, native Pi, and
  project paths documented by the adapter. PromptHub writes compatible JSON and
  does not execute or install `pi-mcp-adapter`.
- `#202`: added additive `envRefs` and `headerRefs` fields, normalization for
  `${VAR}`, `${env:VAR}`, `$VAR`, `$env:VAR`, target-specific rendering,
  reference-aware health warnings, direct/reference form fields, env-import
  conversion from reference to local literal, and redacted
  renderer/IPC/preview/apply/remove/backup/CLI transport boundaries.
- Redacted restore and update paths preserve matching local literal values
  instead of writing `[REDACTED]` into the active library. Existing target files
  still receive the selected direct values through the existing atomic writer.
- TOML redaction parsing now lives in a dedicated shared utility so the main MCP
  config module stays within the repository's preferred file-size limit.
- Stable Pi/MCP compatibility documentation and the local GitHub delivery
  overlay were updated. The `pi-agent-separation` boundary now explicitly
  distinguishes native Agent capability from the separate MCP config writer.

## Verification

- TDD red phase was recorded before implementation for the shared reference,
  Pi preset, and project distribution scenarios.
- `pnpm --filter @prompthub/desktop exec vitest run` over the 20 MCP-related
  unit files: passed, 20 files / 170 tests.
- The focused renderer/core/IPC health and restore regressions passed; the
  final desktop run includes the direct/reference, Pi, project-target, health,
  and IPC redaction coverage.
- `pnpm --filter @prompthub/core exec vitest run tests/mcp-market-reconciliation.test.ts tests/mcp-env-import.test.ts tests/mcp-target-sync-policy.test.ts`: passed, 3 files / 12 tests.
- `pnpm --filter @prompthub/cli exec vitest run tests/workspace-sync.test.ts`: passed, 5 tests, including redacted MCP export, remote push, and local-literal restore assertions.
- `pnpm --filter @prompthub/shared exec tsc --noEmit`: passed.
- `pnpm --filter @prompthub/core exec tsc --noEmit`: passed.
- `pnpm --filter @prompthub/desktop exec tsc --noEmit`: passed.
- `pnpm --filter @prompthub/cli exec tsc --noEmit`: passed.
- Affected desktop and CLI ESLint checks passed.
- `pnpm lint:file-size`, `pnpm spec:test`, `pnpm spec:index:check`,
  `pnpm spec:traceability`, the affected Prettier check, and `git diff --check`
  passed.
- `pnpm verify:release:quick` reached the repository-wide desktop unit gate but
  remains red on unrelated current-worktree issues: an unused ESLint disable in
  `apps/desktop/src/main/services/agent-pi-model-catalog.ts:78` and 8 image
  generation workbench assertions across 3 files. The MCP-focused suite remains
  green; those unrelated files were not changed by this implementation.

## Risks And Follow-up

- Direct MCP values remain local plaintext for backward compatibility; this
  change protects transport and UI boundaries but does not introduce a new
  keychain or encrypted-at-rest secret store.
- Pi runtime discovery and effective precedence remain owned by the installed
  Pi adapter/runtime. PromptHub exposes each documented layer independently and
  does not claim runtime resolution.

## Publication Evidence

- Release:
  <https://github.com/legeling/PromptHub/releases/tag/v0.6.0-beta.1>
- Desktop release workflow:
  <https://github.com/legeling/PromptHub/actions/runs/32265536666>
- Self-Hosted Web workflow:
  <https://github.com/legeling/PromptHub/actions/runs/32265536642>
- GitHub #200, #201, and #202 are remotely closed; the repository open/closed
  snapshots and local delivery overlay were refreshed on 2026-08-20.
