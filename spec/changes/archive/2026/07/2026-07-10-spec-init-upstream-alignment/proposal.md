# Proposal: Align PromptHub With Current Spec-init

## Why

PromptHub claims alignment with the latest `spec-init`, but its embedded skill
predates the upstream phase workflow, verification documentation model,
document archive rules, and completed-change convergence gates. The repository
has adopted the top-level document categories without adopting all governance
behavior behind them.

## Scope

- Pin the audit baseline to upstream `legeling/spec-init` commit `f83def1`.
- Synchronize the embedded generic skill assets while preserving a small
  PromptHub-specific profile.
- Add `specify -> clarify -> plan -> tasks -> analyze -> implement -> converge`
  to the PromptHub topology and operating rules.
- Add the seven stable verification document surfaces required by current
  `spec-init`.
- Add PromptHub-adapted document archive and record-ID rules without renaming
  existing history.
- Strengthen local change templates and record remaining historical governance
  debt explicitly.

## Non-goals

- Rename the 146 existing archived change directories.
- Replace PromptHub's `proposal/specs/design/tasks/implementation` change
  contract with upstream's generic scaffold contract.
- Move active changes whose completion or release state requires product-owner
  confirmation.
- Modify unrelated dirty application or test files.

## Risk And Rollback

The main risk is creating competing paths between upstream `completed/` and
PromptHub's established `archive/`. PromptHub keeps `archive/` authoritative,
maps the converge phase to it, and retains `completed/` only as a compatibility
entry. Rollback restores the previous embedded skill and removes the additive
topology, rule, verification, and template records.
