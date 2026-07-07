# Tasks

- [x] `T-ICON-001`: Add QClaw renderer icon asset and map `qclaw` to it. Covers `FR-ICON-001`, `DES-ICON-001`, `TEST-ICON-001`.
- [x] `T-ICON-002`: Add WorkBuddy renderer icon asset and map `workbuddy` to it. Covers `FR-ICON-002`, `DES-ICON-002`, `TEST-ICON-002`.
- [x] `T-ICON-003`: Confirm TRAE variants stay on the TRAE icon and cover that mapping with tests. Covers `FR-ICON-003`, `DES-ICON-003`, `TEST-ICON-003`.
- [x] `T-ICON-004`: Run focused renderer icon tests, desktop typecheck, and diff whitespace validation.

## Verification Items

- `TEST-ICON-001`: Component test asserts QClaw uses `qclaw.png` and not `openclaw.png`.
- `TEST-ICON-002`: Component test asserts WorkBuddy uses `workbuddy.svg`.
- `TEST-ICON-003`: Component test asserts TRAE variants use `trae.png`.
- `TEST-ICON-004`: Asset validation confirms new PNG/SVG files are readable by the local toolchain.
