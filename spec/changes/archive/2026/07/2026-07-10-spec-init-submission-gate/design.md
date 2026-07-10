# Design: Spec-init Submission Gate

## DES-COMMIT-001: Scaffold asset and generator

Add localized `commit-rules.md.tmpl` assets and explicitly render them from
`scripts/spec-init.sh`. Register the generated file in localized rule indexes
and `AGENTS.md` templates. Keep the rules as assets because they are copied into
new projects and are not runtime skill instructions.

## DES-COMMIT-002: PromptHub pre-commit gate

Add a concise mandatory lookup to the embedded skill's PromptHub profile and to
the root `AGENTS.md`. Strengthen `spec/rules/submission-traceability-rules.md`
so every non-trivial commit requires a body containing a summary, primary
traceability reference, and actual verification state.

## Compatibility

Existing projects are not rewritten by the scaffold. The generated commit
title remains Conventional Commits compatible; the change strengthens the
required body without changing Git tooling.

## Verification

- `TEST-COMMIT-001`: Initialize temporary Chinese and English projects and
  assert the commit rules are generated and linked.
- `TEST-COMMIT-002`: Assert PromptHub and generated AGENTS/rule files contain
  the mandatory pre-commit and body requirements.
