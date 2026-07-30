# Implementation

## Status

- Phase: implement
- Status: verification-pending

## Shipped

- Both detail and menu "Copy Prompt" actions now call the canonical workspace
  copy handler.
- The copy plan applies zero, one, or multiple output-format mappings in stable
  order while retaining source Prompt usage attribution.
- Variable, language, copied-state, toast, queue cleanup, and source identity
  are shared. Review also cleared the source identity after a single variable
  copy completes or its clipboard write fails.

## Verification

- Copy parity/plan/flow: 8 tests passed, including cancellation, clipboard
  failure cleanup, and a 10,000-row planning regression.
- Desktop focused run: 129 tests passed.
- Desktop typecheck and targeted ESLint: passed.
- Focused coverage and the running-Desktop walkthrough remain follow-up
  release gates.

## Analyze

- Traceability complete: implementation and behavior tests are mapped; focused
  coverage and running-Desktop verification remain open.
- Conflicts/blockers resolved: the existing output-format pipeline is the
  canonical behavior for every same-named copy action.

## Converge

- Stable Prompt behavior and local issue overlay synced: yes.
- GitHub issue remains open until release.
- Final change destination: active until release assignment.

## Synced Docs

- `spec/knowledge/behavior/prompt-workspace.md`

## Follow-ups

- A separately named raw-copy action requires a distinct product requirement
  and is not part of this fix.
