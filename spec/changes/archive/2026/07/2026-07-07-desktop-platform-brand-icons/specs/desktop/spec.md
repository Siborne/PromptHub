# Desktop Platform Icon Delta Spec

## Requirements

### `FR-ICON-001` QClaw Brand Asset

The desktop renderer must display the QClaw brand icon for platform id `qclaw` and must not reuse the OpenClaw icon.

### `FR-ICON-002` Tencent WorkBuddy Brand Asset

The desktop renderer must display a dedicated Tencent WorkBuddy icon for platform id `workbuddy` instead of the generic platform fallback.

### `FR-ICON-003` TRAE Variant Brand Consistency

The desktop renderer must keep `trae`, `trae-work`, `trae-cn`, and `trae-work-cn` on the TRAE brand icon unless a future accepted design records a different Work-specific asset.

## Acceptance Criteria

- `AC-ICON-001`: Rendering `PlatformIcon` with `platformId="qclaw"` produces an image source containing `qclaw.png`.
- `AC-ICON-002`: Rendering `PlatformIcon` with `platformId="qclaw"` does not produce an image source containing `openclaw.png`.
- `AC-ICON-003`: Rendering `PlatformIcon` with `platformId="workbuddy"` produces an image source containing `workbuddy.svg`.
- `AC-ICON-004`: Rendering `PlatformIcon` with each TRAE variant produces an image source containing `trae.png`.

## Traceability

| Requirement | Acceptance | Design | Verification | Task |
| --- | --- | --- | --- | --- |
| `FR-ICON-001` | `AC-ICON-001`, `AC-ICON-002` | `DES-ICON-001` | `TEST-ICON-001` | `T-ICON-001` |
| `FR-ICON-002` | `AC-ICON-003` | `DES-ICON-002` | `TEST-ICON-002` | `T-ICON-002` |
| `FR-ICON-003` | `AC-ICON-004` | `DES-ICON-003` | `TEST-ICON-003` | `T-ICON-003` |
