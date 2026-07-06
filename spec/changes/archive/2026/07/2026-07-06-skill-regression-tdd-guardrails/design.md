# Design

## Overview

Add a skill-domain regression matrix that maps real escaped bugs to:

- missed invariant
- lowest effective test layer
- required regression test item
- release harness category

Then update project testing rules so a future skill fix must:

1. reproduce the user-visible failure first;
2. assert observable state across list/detail/project/platform/filesystem surfaces;
3. avoid mock-only success assertions;
4. record the chosen test layer in the active change.

## Affected Areas

- Data model: none.
- IPC / API: none.
- Filesystem / sync: none.
- UI / UX: no runtime UI change.
- Verification:
  - Adds `spec/knowledge/reference/skill-regression-test-matrix.md`.
  - Updates `spec/rules/testing-standards.md`.
  - Updates `spec/workflow/04-verification/README.md`.

## Tradeoffs

- A matrix is stricter than a generic testing rule but easier for agents to follow because it names concrete expected scenarios.
- The matrix intentionally separates required test items from implementation tasks so it does not prescribe the code fix.
