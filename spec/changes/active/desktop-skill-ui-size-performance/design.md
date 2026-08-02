# Design

<!-- traceability: enforced -->

## `DES-DSUP-001`: Responsibility-Based Renderer Extraction

Keep all durable behavior and side effects in the existing owning component. Extract only renderer responsibilities and pure derived view data:

- `SkillFileEditor` retains source loading, reads/writes, mutation orchestration, and unsaved-change policy; a memoized file-tree component owns recursive tree rendering.
- `SkillStore` retains store actions and remote orchestration; pure source metadata/category derivation moves to a view-model module, and the catalog boundary is memoized with stable inputs.
- `SkillStoreDetail` retains install/update/translation/safety orchestration; expensive presentation content moves behind a memoized component whose props include every visible dependency.

The extraction target is comfortable headroom rather than a one-line pass under the threshold. New modules remain below the 1,000-line default.

## `DES-DSUP-002`: Render Stability

Memoization is applied only where a high-frequency parent state can invalidate an expensive child subtree. Inputs are normalized to stable primitives, sets, arrays, or callbacks before crossing the memo boundary. No custom comparison function will hide state dependencies unless a focused test covers every ignored field.

## Affected Areas

- Data model: unchanged.
- IPC / API: unchanged.
- Filesystem / sync: unchanged; current file editor calls and save-sync scheduling remain owned by `SkillFileEditor`.
- UI / UX: structure and interactions remain unchanged; only internal component boundaries and render frequency change.

## Tradeoffs

- Additional modules increase navigation depth but give each renderer responsibility a narrower change surface.
- Shallow prop comparison is effective only with stable parent inputs, so callback/derived collection stability is part of the design.
- The change avoids a new global store or context because there is no new durable state or cross-surface business rule.

## Failure And Rollback

- External boundary: existing Skill filesystem, network store, and install/update functions remain untouched.
- Partial failure behavior: unchanged; extraction introduces no additional writes.
- Recovery/rollback: revert or inline the renderer modules; no migration is needed.

## Analyze Result

- Requirement links: `FR-DSUP-001` through `FR-DSUP-003`.
- Verification links: `TEST-DSUP-001` through `TEST-DSUP-004`.
- Blocking conflicts: none. The existing `desktop-frontend-perf-tuneup` explicitly excluded these Skill files and can coexist with this narrower change.
- Unresolved `[待确认]`: none for this renderer-only refactor.

## Traceability

| Requirement   | Design                         | Verification                     | Task         |
| ------------- | ------------------------------ | -------------------------------- | ------------ |
| `FR-DSUP-001` | `DES-DSUP-001`                 | `TEST-DSUP-001`                  | `T-DSUP-004` |
| `FR-DSUP-002` | `DES-DSUP-001`, `DES-DSUP-002` | `TEST-DSUP-002`, `TEST-DSUP-004` | `T-DSUP-004` |
| `FR-DSUP-003` | `DES-DSUP-001`, `DES-DSUP-002` | `TEST-DSUP-003`, `TEST-DSUP-004` | `T-DSUP-004` |
