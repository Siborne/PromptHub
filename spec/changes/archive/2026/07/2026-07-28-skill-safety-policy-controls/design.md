# Design

## Ownership

- `apps/desktop/src/renderer/stores/settings/*`: persisted user policy and
  mutations.
- `apps/desktop/src/renderer/services/skill-safety-policy.ts`: pure channel
  classification and precedence resolution.
- `apps/desktop/src/renderer/components/settings/*`: policy editor.
- Skill Store components/controllers: resolve exact source context and pass the
  chosen mode through install/update operations.
- `packages/shared/types/skill.ts`: typed lifecycle scan mode.
- `packages/core/src/skills/package-operation.ts`: IPC request validation.
- `apps/desktop/src/main/services/*`: enforce enabled mode or skip content
  scanning while retaining package validation.

## DES-SAFETY-001 Persisted Policy

Keep `autoScanStoreSkillsBeforeInstall` as the global default. Add:

- `skillSafetyChannelPolicies`
- `skillSafetyStorePolicies`

Only explicit `enabled` and `disabled` values are persisted. Missing keys mean
`inherit`. Settings persistence version increments once and migration
normalizes malformed or oversized records.

## DES-SAFETY-002 Pure Resolver

The resolver accepts a bounded policy snapshot and a source context:

```text
{ storeId, channel }
```

It performs constant-time lookup:

```text
store policy ?? channel policy ?? global boolean
```

Built-in source/channel metadata is defined once. Custom stores derive their
channel from `SkillStoreSource.type`. Callers outside the current Store view
may infer a conservative channel from registry source metadata, but exact UI
flows pass the selected store context.

## DES-SAFETY-003 Explicit Lifecycle Contract

`SkillPackageOperationRequest.safetyScan` adds:

```text
mode?: "enabled" | "disabled"
```

Current renderer operations always send an explicit mode. Main behavior:

- `disabled`: return without reading `SKILL.md` for content scanning and
  without invoking preflight/AI scanners.
- `enabled` or legacy missing mode: run deterministic preflight and optional AI
  review as before.

The surrounding lifecycle still calls `validateMaterializedSkillPackage` and
computes the directory fingerprint before applying the package.

## DES-SAFETY-004 UI And Workflow

Security settings retain the two top-level automatic scan switches. Below the
Store switch, channel and exact-store rows use a three-state select:
`inherit`, `enabled`, `disabled`.

Install/update preview dialogs remain available when scans are disabled and
show the existing “not run” state. Detail flows conditionally invoke
`scanSafety`; confirmation rechecks changed package content only when the
resolved mode is enabled. Manual scan buttons are unchanged.

## Verification Mapping

| Requirement    | Design                                         | Verification                     | Task                       |
| -------------- | ---------------------------------------------- | -------------------------------- | -------------------------- |
| FR-SAFETY-001  | DES-SAFETY-001, DES-SAFETY-004                 | TEST-SAFETY-001, TEST-SAFETY-002 | T-SAFETY-001, T-SAFETY-003 |
| FR-SAFETY-002  | DES-SAFETY-001, DES-SAFETY-002                 | TEST-SAFETY-001, TEST-SAFETY-002 | T-SAFETY-001, T-SAFETY-003 |
| FR-SAFETY-003  | DES-SAFETY-002, DES-SAFETY-003, DES-SAFETY-004 | TEST-SAFETY-003, TEST-SAFETY-004 | T-SAFETY-002, T-SAFETY-004 |
| FR-SAFETY-004  | DES-SAFETY-004                                 | TEST-SAFETY-002, TEST-SAFETY-003 | T-SAFETY-003               |
| NFR-SAFETY-001 | DES-SAFETY-003                                 | TEST-SAFETY-004                  | T-SAFETY-004               |
| NFR-SAFETY-002 | DES-SAFETY-001                                 | TEST-SAFETY-001                  | T-SAFETY-001               |

## Analyze Gate

- Requirements without design: none.
- Design without verification: none.
- Tasks without requirement and test traceability: none.
- Blocking `[待确认]`: none.
- Material conflict: stable Skill Store documentation says scanning is
  unconditional. The explicit user requirement supersedes that behavior for
  content safety scanning; stable documentation will be updated during
  converge. Immutable package validation remains consistent with existing
  security rules.
- Complexity: policy resolution is `O(1)` time and space per operation; settings
  rendering is `O(s)` for `s <= built-ins + 512` stores.
