# Repository Quality Gates and Change Convergence

## Why

PromptHub's pull-request quality workflow currently verifies the desktop app
regardless of the files changed, while CLI, mobile, shared packages, and the
Cloudflare Worker do not have an equivalent path-aware gate. The active change
inventory also contains completed work that should already be archived.

## Scope

- Archive completed active changes whose tasks and implementation records show
  no remaining delivery work.
- Keep release-pending work active and make that status explicit.
- Add deterministic changed-path classification for pull-request checks.
- Run governance checks on every pull request and run workspace checks only
  when their dependency surface changes.
- Include the Cloudflare Worker in the existing web workflow.

## Risks

- An incomplete path map could skip a required workspace check.
- Archiving a change with unfinished release work would hide outstanding work.
- More parallel CI jobs increase aggregate runner usage when shared packages
  change.

## Rollback

The workflow can return to the single desktop job without changing product
data. Archived change folders can be moved back to `active/` if their recorded
status was incorrect.
