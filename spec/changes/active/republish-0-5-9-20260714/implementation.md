# 0.5.9 Replacement Release Implementation

## Status

Release documentation is synchronized and the full local release gate passed.
Remote publication remains mandatory before this change can be archived.

## Verification

- Focused implementation suites, Desktop lint, Desktop typecheck, Desktop build,
  hidden-startup synchronization E2E, and diff checks passed before release
  preparation.
- `pnpm verify:release`: passed all 22 stages in 934.6 seconds (CLI 86, Desktop
  unit 3,256, Desktop integration 40, Desktop E2E 7, Web 337, Worker 10 tests).
- Desktop Build and Release tag workflow: pending.
- Self-Hosted Web tag workflow: pending.

## Stable Records

- `CHANGELOG.md`
- `spec/releases/0.5.9.md`
- `spec/releases/README.md`
- `spec/knowledge/behavior/desktop.md`
