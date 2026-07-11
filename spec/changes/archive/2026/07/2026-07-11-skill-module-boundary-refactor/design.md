# Design

## DES-SMB-001 Domain-Owned Boundary Map

### Main Process

- `skill-installer.ts`: facade and install/materialization orchestration.
- `skill-update-safety.ts`: mandatory preflight, optional AI report combination, hard-block policy, fingerprint-pinned review error.
- Existing repo/remote/internal modules continue to own filesystem and network primitives.

### Renderer Store

- `skill.store.ts`: Zustand composition and public actions only.
- `skill-source-update-workflow.ts`: source resolution, B/L/R update orchestration, remote materialization, rollback, and structured review result.
- `skill-store-types.ts`: public state/action contracts shared by store slices without importing the store singleton.
- `skill-library-slice.ts`: local inventory CRUD, import, safety scans, deployment status, and visible-library selectors.
- `skill-scan-slice.ts`: project and Agent scan state plus scan orchestration.
- `skill-registry-slice.ts`: registry inventory, custom sources, install/uninstall, and source-update actions.
- `skill-translation-slice.ts`: translation orchestration and cache actions.
- `skill-store-persistence.ts`: persisted-state projection, validation, normalization, and hydration merge.
- `skill-store-domain.ts`: pure error redaction, scan-path derivation, safety score, and content completeness rules.

### Renderer UI

- `SkillFullDetailPage.tsx`: page composition and selected-Skill coordination.
- `SkillUpdateSafetyReviewDialog.tsx`: review findings, trust checkbox, and confirm/cancel presentation.
- Detail sections: header/actions, tabs, content/files, distribution, and
  modal coordination own their respective presentation boundaries.

### Settings

- `settings.store.ts` remains the persistence composition root.
- Domain modules own appearance, AI/model, Skill/platform, projects,
  sync/network, shortcuts, and update settings. Slice state remains
  serializable and migration stays centralized.

### Tests

- Source-update reconciliation/service tests own pure state-machine cases.
- Main safety tests own staging, fingerprint, path, blocked, and structured IPC cases.
- Renderer workflow tests own review/trust/retry/rollback cases.
- Component tests own visible dialog actions only.

## DES-SMB-002 Dependency Direction

Components depend on store actions and presentation types. Store slices receive typed `set` and `get` dependencies from the composition root and never import the store singleton. The store depends on renderer services. Renderer services depend on `packages/core` and `packages/shared`, never on the store singleton. Main-process safety policy depends on shared types and main scan primitives, not IPC handlers.

## DES-SMB-003 Incremental Compatibility

1. Extract policy and pure helpers first with existing tests unchanged.
2. Introduce typed workflow inputs, then delegate existing store actions.
3. Move focused tests after behavior is stable.
4. Split store, settings, and detail responsibilities one domain at a time,
   keeping each step buildable and testable.
5. Enable the line-count gate for changed files immediately; expand to repository-wide enforcement after legacy files are migrated.

## DES-SMB-004 Focused Verification Boundaries

- `TEST-SMB-001` runs the repository line-limit gate against every extracted module.
- `TEST-SMB-002` covers main-process safety, fingerprint approval, and source-update workflow contracts.
- `TEST-SMB-003` covers persisted Skill state, preload/IPC return values, and detail/settings UI behavior.
- `TEST-SMB-004` keeps assertions in independently owned suites while shared files contain fixtures and setup only.

## Risks

- Zustand helpers can accidentally import the store singleton and create cycles. Dependencies must be passed through typed inputs.
- Moving rollback logic can change side-effect order. Existing failure tests remain the contract.
- Test splitting can hide shared state leakage. Each suite must own explicit reset/setup helpers.
