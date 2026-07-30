# Regression Suite

## Standard Commands

| Scope          | Command                                           | Use                                      |
| -------------- | ------------------------------------------------- | ---------------------------------------- |
| Focused        | `pnpm --filter <package> exec vitest run <files>` | first feedback for the changed invariant |
| Desktop unit   | `pnpm --filter @prompthub/desktop test:unit`      | renderer/main/service regression         |
| Desktop E2E    | `pnpm test:e2e`                                   | critical Electron workflows              |
| Root quick     | `pnpm verify:release:quick`                       | local multi-package diagnosis            |
| Root changed   | `pnpm verify:changed`                             | affected-surface local/PR diagnosis      |
| Root release   | `pnpm verify:release`                             | release approval                         |
| Harness unit   | `pnpm test:verification-harness`                  | registry/executor/report regression      |
| Lint/typecheck | package-specific or root scripts                  | static contract and quality gates        |

## Trigger Rules

- Run focused tests before broader suites.
- Run affected package lint/typecheck for production-code changes.
- Run integration/E2E only when the risk crosses the corresponding boundary.
- Run the full release harness for release candidates and release-risk changes.
- Use `--surface`, `--exclude-layer`, and `--list --format json` for bounded CI
  selection; do not replace the registry with handwritten workflow commands.
- `--report <path>` is opt-in, writes a bounded redacted JSON report, and treats
  an unwritable explicit report path as a command failure.
- A failed aggregate run followed by passing focused tests is not silently
  converted to success; record both the failure and confirmation run.

## Domain Suites

- Skill changes use `spec/knowledge/reference/skill-regression-test-matrix.md`.
- Release-harness behavior uses
  `spec/changes/active/risk-aware-verification-harness/` while it is active and
  its dated archive after convergence.
- New durable domain matrices live under `spec/knowledge/reference/` and are
  linked from this file.
