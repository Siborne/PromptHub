# Proposal: Spec-init Submission Gate

## Why

PromptHub's embedded `spec-init` skill links to a commit-rules document but does
not ship or generate that document. Its generated `AGENTS.md` also lacks an
explicit pre-commit gate, so newly initialized projects can receive detailed
spec and testing rules without enforceable submission guidance.

## Scope

- Generate localized commit rules for new `spec-init` projects.
- Make generated and PromptHub `AGENTS.md` files point to the submission rules
  before any commit operation.
- Require non-trivial commit bodies to record traceability and verification.
- Add a scaffold regression test for both supported languages.

## Non-goals

- Broadly synchronize every difference between the embedded and globally
  installed `spec-init` copies.
- Change repository history or rewrite unrelated commits in a dirty worktree.

## Risk And Rollback

The change affects documentation templates and scaffold output only. Rollback
removes the new templates, generator entry, and rule references; existing
generated projects remain unchanged.
