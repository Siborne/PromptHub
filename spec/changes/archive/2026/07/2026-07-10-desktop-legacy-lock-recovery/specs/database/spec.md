# Desktop Legacy Lock Recovery Delta

## FR-LEGLOCK-001 Desktop upgrade recovery

Desktop MUST recover an ownerless ordinary `.lock` directory left by a
pre-lease PromptHub version after it has won the application single-instance
gate.

## FR-LEGLOCK-002 Shared default safety

CLI and other shared callers MUST preserve an unregistered lock unless their
host explicitly guarantees exclusive legacy-process ownership.

## NFR-LEGLOCK-001 Live writer safety

Opt-in legacy recovery MUST still preserve registered live clients, unremovable
lease entries, symbolic links, and non-directory lock paths.

## Acceptance Criteria

- `AC-LEGLOCK-001`: Desktop initializes successfully with an ownerless legacy lock.
- `AC-LEGLOCK-002`: shared initialization preserves the same lock by default.
- `AC-LEGLOCK-003`: registered live owners remain protected in both modes.
