# Desktop Platform Brand Icons

## Background

QClaw was rendered with the OpenClaw icon, and Tencent WorkBuddy was rendered through the generic fallback because no dedicated renderer icon asset was wired. TRAE Work needed confirmation because its product family shares the TRAE brand treatment.

## Purpose

The change corrects misleading platform branding in the desktop settings and platform list surfaces so users can distinguish QClaw, OpenClaw, TRAE variants, and Tencent WorkBuddy at a glance.

## Scope

- Correct the desktop renderer icon mapping for `qclaw`.
- Add a dedicated desktop renderer icon mapping for `workbuddy`.
- Keep `trae`, `trae-work`, `trae-cn`, and `trae-work-cn` on the shared TRAE icon.
- Add regression coverage for the affected platform icon mapping.

## Impact Scope

- User-visible impact: platform rows and icon-only surfaces render corrected brand icons for QClaw and Tencent WorkBuddy.
- Module impact: desktop renderer `PlatformIcon` mapping, bundled renderer assets, and focused component tests.
- No data impact: no SQLite, runtime path, settings, sync, or migration changes.
- No contract impact: no IPC, preload, CLI, route, shared type, platform root, MCP, installer, or skill store contract changes.

## Non-Goals

- No platform root path, MCP target, installer, or skill store behavior changes.
- No broader platform ordering or marketplace source changes.

## Risk And Rollback

The change is limited to renderer image imports and tests. Rollback is removing the new icon assets and restoring the previous `PlatformIcon` mapping.

## Synced Documents

- `spec/changes/archive/2026/07/2026-07-07-desktop-platform-brand-icons/specs/desktop/spec.md`
- `spec/changes/archive/2026/07/2026-07-07-desktop-platform-brand-icons/design.md`
- `spec/changes/archive/2026/07/2026-07-07-desktop-platform-brand-icons/tasks.md`
- `spec/changes/archive/2026/07/2026-07-07-desktop-platform-brand-icons/implementation.md`

No stable workflow, knowledge, ADR, release, or external `docs/` page was updated because this is a renderer-only visual correction with no durable behavior or contract change.

## Open Questions

- None for this change. A future WorkBuddy remote Skill Store integration would require a separate active change because it affects source validation and store behavior.

## Traceability

| Requirement | Design | Verification | Task |
| --- | --- | --- | --- |
| `FR-ICON-001` | `DES-ICON-001` | `TEST-ICON-001` | `T-ICON-001` |
| `FR-ICON-002` | `DES-ICON-002` | `TEST-ICON-002` | `T-ICON-002` |
| `FR-ICON-003` | `DES-ICON-003` | `TEST-ICON-003` | `T-ICON-003` |
