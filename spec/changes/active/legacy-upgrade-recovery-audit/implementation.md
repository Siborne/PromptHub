# Legacy Upgrade Recovery Audit Implementation

## Status

Design and repository-history audit are complete. No production remediation or
historical fixture has been implemented yet.

## Completed Evidence Work

- Correlated #89 with the v0.4.7 to v0.4.8 Windows runtime-path change and the
  reporter's install-directory to roaming-directory observation.
- Separated #97 into portable JSON backup import and automatic upgrade-snapshot
  restore boundaries.
- Confirmed that both v0.5.1 and v0.5.2 portable formats include Prompt
  `versions`, while current `PromptDb.getVersions` requests the complete ordered
  chain.
- Mapped current ownership to `packages/core`, `packages/db`, shared contracts,
  and desktop main/renderer boundaries without introducing a competing recovery
  framework.
- Converted the next phase into fixture-first tasks with explicit safety,
  rollback, restart, and performance gates.

## Verification

- Repository source/tag audit: completed; facts recorded in `evidence.md`.
- Historical fixture tests: not run; fixture builders do not exist yet.
- Production tests: not run because this iteration changes design records only.
- `pnpm spec:index:check`: passed.
- `pnpm spec:test`: passed, including governance, inventory, single-source, and
  traceability checks for 22 enforced changes.
- `git diff --check`: passed.

## Remaining Risk

Current recovery code and tests provide strong partial coverage, but they do not
yet prove that real v0.4.7/v0.4.8 path layouts, a v0.5.1 backup, and a four-version
v0.5.2 Prompt survive the complete current application path. Issues #89, #97,
and #98 remain open and must not be marked locally done from this design alone.
