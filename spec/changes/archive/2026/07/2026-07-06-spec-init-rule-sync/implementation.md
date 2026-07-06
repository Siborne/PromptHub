# Implementation

## Shipped

- Added PromptHub-adapted rule entries for bug fixes, clarification, coding standards, and issue management.
- Updated the rule index and document routing rules so new `spec-init` rule categories map to PromptHub's existing `spec/*` topology.
- Documented folder naming and numbering rules for workflow stages, active change keys, archive date prefixes, and in-file traceability IDs.
- Renamed the single non-conforming active change folder from `readme-screenshots-v0.5.6` to `readme-screenshots-v0-5-6`.
- Archived 135 completed historical active changes to `spec/changes/archive/2026/07/2026-07-06-*/`.
- Normalized all 142 date-prefixed archived change folders under `spec/changes/archive/<YYYY>/<MM>/`.
- Updated exact path references from archived `spec/changes/active/<change-key>` paths to their new archive paths.
- Updated `AGENTS.md` and `spec/README.md` with concise references to the expanded rule surface.
- Archived this rule-sync change after verification completed.
- Kept 19 active changes in place because they are unfinished or explicitly still in progress.

## Verification

- Searched package scripts, automation scripts, `spec/`, and `AGENTS.md` for the accidental audit/backfill identifiers; no intended production or rule references remain.
- Searched for references to the old `readme-screenshots-v0.5.6` change key before renaming; no repository references were found.
- Checked active change directory names against lowercase kebab-case; no invalid names remain.
- Active change count is now 19; historical archive folders created for this cleanup: 135.
- Remaining active classification: 16 unfinished and 3 explicitly in progress.
- Archive root now contains year/month folders; direct date-prefixed change folders at `spec/changes/archive/` count is 0.
- `git diff --check` passed.

## Notes

- Large-scale historical change-folder renaming is intentionally not implemented in this change. It needs a separate plan because renaming active change directories changes paths and references.
