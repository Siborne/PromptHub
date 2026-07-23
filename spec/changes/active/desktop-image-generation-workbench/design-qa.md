# Desktop Image Generation Workbench Design QA

## Reference

- Accepted concept: `assets/workbench-ui-concept-v2.png`
- Target hierarchy: dominant left result canvas, fixed right generation inspector,
  on-demand batch drawer, and bright card surfaces with restrained neutral controls.

## Implementation Review

- Navigation placement matches the Prompts secondary-navigation boundary.
- The former oversized form-and-empty-canvas layout has been replaced by the
  accepted three-zone workbench hierarchy.
- Gallery sort, density controls, multi-selection, batch selection, cancel/retry,
  favorite, download, Prompt attachment, and new-batch controls are interactive.
- Generated originals remain local; Prompt attachment uses an explicit copied media
  asset and does not change the generation original.

## Visual Result

- First implementation capture failed visual QA: viewport breakpoints were based on
  the whole window instead of the narrowed workbench column. The configuration row
  overflowed beneath the fixed queue, compressed the Generate label vertically, and
  forced an unnecessary horizontal gallery-toolbar scrollbar.
- The configuration row now uses intrinsic auto-fit tracks, compact fixed actions,
  and natural wrapping. The gallery toolbar wraps without horizontal scrolling.
- Post-fix Electron capture completed at the reference viewport, `1596x986`. The
  generated local capture is `output/playwright/image-generation-workbench-1596x986.png`.
- Browser measurements report no document, configuration-row, or gallery-toolbar
  horizontal overflow; the Generate control remains a stable `103x36` px element.
- The screenshot seed now uses the persisted `icon:<name>` folder-icon format, removing
  fixture-only text/icon overlap from visual QA.
- Status: passed for the empty workbench hierarchy and responsive overflow regression.
  Populated gallery states remain covered by component tests and still need a dedicated
  visual fixture before final convergence.

## 2026-07-17 UI Refinement

- Tightened the composer hierarchy with stable 40 px controls, clearer focus treatment,
  a stronger primary action, and an explicit local-device storage indicator.
- Added an actionable missing-image-model state instead of leaving Generate disabled
  without explanation.
- Removed the stacked empty placeholders in the right panel. An empty library now has
  one queue state; batch provenance appears only when a batch exists.
- At viewports below 1440 px, the fixed queue no longer compresses the result canvas.
  It moves into a closable, Escape-aware side sheet while the queue trigger remains in
  the workbench header.
- Batch cards now expose determinate progress semantics and status icons. Selected output
  previews use the available panel width, and list density includes useful model/time
  metadata instead of behaving like a short image tile.
- Component verification covers the missing-model explanation, compact queue sheet,
  Escape/close behavior, and single empty-state invariant.
- A revised Electron screenshot was attempted after a successful production build, but
  both the direct Playwright launch and the existing Electron smoke test timed out before
  the first window became available. The earlier capture remains a baseline only; no
  post-refinement visual-pass claim is recorded.

## 2026-07-22 Two-Column Redesign

- The user explicitly replaced the prior top-composer direction with
  `assets/workbench-ui-concept-v2.png`.
- The implementation capture is `assets/workbench-ui-implementation-v2.png`, recorded
  at the same `1586x992` viewport as the accepted concept.
- The result canvas now owns the dominant left region. Prompt, model, ratio, quality,
  count, execution Prompt, references, advanced disclosure and the Generate action live
  in the fixed right inspector.
- User review found the queue under the composer too cumbersome. The right inspector now
  contains generation settings only; clicking the running-batch status opens a temporary
  drawer for batch switching, provenance and new-batch actions.
- Main work surfaces use the white `card` token instead of the gray page `background`
  token. Muted gray is limited to controls, dividers and secondary status surfaces.
- User review clarified that the fixed inspector is part of the workbench rather than an
  optional compact control. The previous below-`1280px` settings sheet and header trigger
  were removed; the full inspector now remains visible at every supported Desktop width.
- At the user's effective `1008x622` CSS viewport, the inspector measured 323 px and the
  result canvas 317 px. The toolbar switched to two rows; its children stayed within the
  canvas and the document reported no horizontal overflow.
- Fixed-inspector presence, empty state, toolbar wrapping and populated-gallery
  interactions are covered by the focused component suite.
- At `1008x622`, the closed state had no queue content in the inspector and no document
  overflow. The on-demand drawer opened at 380 px, exposed one close action, and closed
  through both Escape and its explicit close control.
- Remaining P3: capture a deterministic populated gallery fixture before final change
  convergence; this does not block the accepted structure and empty-state visual pass.
- Final result: passed.
