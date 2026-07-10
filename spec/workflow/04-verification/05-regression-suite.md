# Regression Suite

## Standard Commands

| Scope          | Command                                           | Use                                      |
| -------------- | ------------------------------------------------- | ---------------------------------------- |
| Focused        | `pnpm --filter <package> exec vitest run <files>` | first feedback for the changed invariant |
| Desktop unit   | `pnpm --filter @prompthub/desktop test:unit`      | renderer/main/service regression         |
| Desktop E2E    | `pnpm test:e2e`                                   | critical Electron workflows              |
| Root quick     | `pnpm verify:release:quick`                       | local multi-package diagnosis            |
| Root release   | `pnpm verify:release`                             | release approval                         |
| Lint/typecheck | package-specific or root scripts                  | static contract and quality gates        |

## Trigger Rules

- Run focused tests before broader suites.
- Run affected package lint/typecheck for production-code changes.
- Run integration/E2E only when the risk crosses the corresponding boundary.
- Run the full release harness for release candidates and release-risk changes.
- A failed aggregate run followed by passing focused tests is not silently
  converted to success; record both the failure and confirmation run.

## Domain Suites

- Skill changes use `spec/knowledge/reference/skill-regression-test-matrix.md`.
- Release-harness behavior uses the active or archived
  `release-verification-harness` change record.
- New durable domain matrices live under `spec/knowledge/reference/` and are
  linked from this file.
