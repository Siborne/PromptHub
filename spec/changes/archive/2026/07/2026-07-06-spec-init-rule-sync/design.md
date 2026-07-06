# Design

## Decisions

- `DES-001`: Treat `spec/rules/` as the project-owned adaptation point for the latest `spec-init` rule categories.
- `DES-002`: Add missing rule entry files only when they route to PromptHub's existing stricter rules instead of duplicating full rule text.
- `DES-003`: Keep PromptHub's active change shape: `proposal.md`, `specs/<domain>/spec.md`, `design.md`, `tasks.md`, and `implementation.md`.
- `DES-004`: Do not mass-edit historical active changes as part of this rule sync. Folder naming or numbering cleanup must be a separate, explicit change.
- `DES-005`: Document folder naming and numbering rules in the routing/change docs instead of encoding synthetic IDs into existing active change files.
- `DES-006`: Rename only the single active change directory that violates the new kebab-case rule after confirming it has no repository references.
- `DES-007`: Archive completed historical active changes when their own tasks and implementation records show completion, while leaving unfinished, in-progress, and review-needed changes in active.
- `DES-008`: Store archived changes under year/month folders so `archive/` does not become another flat backlog.

## Affected Files

- `AGENTS.md`
- `spec/README.md`
- `spec/rules/README.md`
- `spec/rules/document-routing-rules.md`
- `spec/rules/change-management-rules.md`
- `spec/changes/README.md`
- `spec/changes/_templates/README.md`
- `spec/changes/archive/2026/*/`
- `spec/changes/active/readme-screenshots-v0-5-6/`
- `spec/rules/bug-fix-rules.md`
- `spec/rules/clarification-rules.md`
- `spec/rules/coding-standards.md`
- `spec/rules/issue-management-rules.md`

## Verification Plan

- `TEST-001`: Review the changed rule index and routing docs for duplicate or competing truth sources.
- `TEST-002`: Search for unintended audit/backfill leftovers and generic `docs/rules/*` routing.
- `TEST-003`: Run markdown diff hygiene checks for trailing whitespace or malformed patches.
- `TEST-004`: Review directory naming guidance against current `spec/workflow/*` and `spec/changes/*` topology.
- `TEST-005`: Check active change directory names against lowercase kebab-case.
- `TEST-006`: Count active and newly archived changes after moving completed records.
- `TEST-007`: Verify archive root contains year/month folders instead of direct date-prefixed change folders.
