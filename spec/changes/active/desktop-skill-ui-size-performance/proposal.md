# Proposal

## Phase And Status

- Phase: analyze
- Status: in-progress
- Primary requirement: `FR-DSUP-001`
- Exit condition: three oversized Skill renderer files pass the preferred line limit, retain their existing behavior, and avoid unnecessary rerenders on editing/search/action state changes.

## Why

The desktop Skill file editor and store surfaces have crossed the enforced 1,500-line preferred ceiling. Their current component boundaries also let frequently changing UI state, such as editor content and store search drafts, invalidate larger subtrees than necessary. This change restores the file-size gate through responsibility-based extraction and adds targeted render isolation without changing the product workflow.

## Scope

- In scope:
  - Split `SkillFileEditor.tsx`, `SkillStore.tsx`, and `SkillStoreDetail.tsx` below the preferred line ceiling.
  - Isolate the file tree from editor keystroke rerenders.
  - Stabilize store-derived view data and the catalog rendering boundary.
  - Isolate expensive detail content from install/update action-state rerenders where the data has not changed.
  - Preserve existing Skill file, store, install, update, translation, and safety behavior.
- Out of scope:
  - Database, IPC, preload, filesystem layout, and sync contract changes.
  - Visual redesign or copy changes.
  - Web Agent management, which is tracked as a following change after its server-side data boundary is inspected.

## Risks

- Extracted component props can drift from the parent orchestration state and leave stale UI.
- Overusing memoization with unstable object or callback props would add complexity without reducing renders.
- Skill Store and file-editor behavior has broad fixture coverage, so a mechanical extraction can still expose hidden import or mock boundaries.

## Rollback Thinking

The change is renderer-only and behavior-preserving. Each extracted component or pure view-model module can be inlined again without data migration or user-data recovery.

## Related Records

- Issue: none
- ADR: none
- Stable workflow/knowledge docs: `spec/knowledge/structure/desktop-frontend-performance.md`, `spec/knowledge/behavior/skills.md`, `spec/rules/code-quality-architecture.md`
