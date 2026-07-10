# Delta Spec

## Added

- PromptHub MUST provide a root release verification harness that can be run before publishing a desktop, CLI, web, or worker release.
- The release harness MUST cover all maintained distribution surfaces: desktop, CLI, web, Cloudflare worker, and shared workspace packages.
- The release harness MUST avoid duplicate validation commands inside the same profile.
- The release harness MUST fail fast and report the failed layer by stable check id.
- Shared workspace packages that are consumed by apps MUST expose explicit package-level typecheck scripts.

## Modified

- Release readiness is no longer defined by desktop-only validation. A release candidate is ready only after the root release harness passes, unless the release scope explicitly excludes a product surface and the skipped surface is documented.

## Removed

- None.

## Scenarios

- Scenario: Maintainer runs a full release gate
  - Given a release candidate
  - When the maintainer runs `pnpm verify:release`
  - Then the harness runs package, CLI, desktop, web, and worker checks exactly once per command
  - And the process exits non-zero on the first failed check

- Scenario: Maintainer needs faster local triage
  - Given a local worktree
  - When the maintainer runs `pnpm verify:release:quick`
  - Then the harness runs the static, unit, and build checks needed for quick feedback
  - And filesystem-backed CLI workspace sync tests use a timeout budget that remains deterministic under full-harness load without relaxing their assertions
  - And it skips the slower release-only desktop integration, performance, bundle, and E2E smoke layers

### `FR-VERIFY-003`: Desktop verification remains reliable and contract-accurate

- Scenario: Desktop unit suite runs under normal workstation load
  - Given the desktop suite contains heavy jsdom and filesystem-backed tests
  - When the maintainer runs the desktop unit command through either release harness profile
  - Then Vitest uses the configured bounded worker pool
  - And the suite preserves file isolation and existing assertion and timeout budgets

- Scenario: Full profile reaches desktop integration coverage
  - Given backup export consumes the renderer output-format listing API
  - And prompt cards are focusable composite selection controls
  - When the desktop integration suite runs
  - Then the backup fixture exposes the current renderer database contract
  - And prompt-card coverage asserts focusability and keyboard activation without requiring a native button `type`

- Scenario: A new check duplicates an existing command
  - Given a future edit to the harness
  - When two checks use the same exact command
  - Then the harness fails before running validation commands
