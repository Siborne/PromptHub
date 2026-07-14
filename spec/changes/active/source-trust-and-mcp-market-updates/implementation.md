# Implementation

## Status

Implemented and locally verified. The change remains active until submission and release convergence.

## Shipped

- Trusted Skill source settings now derive a readable label, sanitized source location, and all matching installed Skill names from the exact persisted authorization key. Unmatched legacy entries remain revocable without exposing an unbounded opaque identifier.
- MCP custom source authorization now lives in an atomic main-process registry under the managed data directory. Catalog IPC requires both `sourceId` and URL, enforces registered origin/path boundaries, and grants private-network HTTP access only to explicitly registered custom sources.
- Renderer/main custom source migration is additive and idempotent. Main-only sources are recovered into the renderer compatibility mirror; failed main-process persistence does not commit renderer source mutations.
- MCP market installs persist template identity, version, and source-owned fingerprints. Detail pages check upstream state and distinguish safe updates, local changes, conflicts, legacy review, and source mismatch.
- Applying an MCP update preserves record identity, user state, env/header values, notes, tags, cwd, bindings, and target files. Existing Agent target projections become visibly stale and require the existing explicit sync action.
- The official MCP Registry adapter carries published versions into templates and version-pins supported npm/PyPI runtime commands. Unsupported runtime types are skipped instead of producing an invalid install command. The same template contract is ready for future PromptHub Official Store entries.
- MCP library responsibilities were extracted into focused environment import, market reconciliation, source registry, and target sync policy modules so the legacy service remains below the hard line limit.

## Verification

- `pnpm test:run`
  - Passed through the final release harness after the skills.sh selector
    regression: 365 files, 3,195 tests.
- `pnpm --dir packages/core test`
  - Passed: 7 files, 52 tests.
- Focused changed-module coverage for the new core MCP modules
  - Passed with 100% statements, branches, functions, and lines.
- `pnpm lint`
  - Passed ESLint and the file-size gate: new files <= 1,500 lines, legacy files did not grow, hard limit 2,000.
- `pnpm typecheck`
  - Passed desktop TypeScript checks.
- `pnpm --dir packages/core typecheck`
  - Passed.
- `pnpm --dir packages/shared typecheck`
  - Passed.
- `pnpm build`
  - Passed renderer, main, and preload production builds.
- `pnpm verify:release:quick`
  - Passed all 18 desktop, CLI, self-hosted web, and Cloudflare worker gates in
    405.4 seconds after the final selector-aware snapshot change.

The full desktop suite still prints pre-existing React `act(...)` warnings in unrelated component tests. They do not fail the suite and were not introduced as a substitute for verification in this change.
