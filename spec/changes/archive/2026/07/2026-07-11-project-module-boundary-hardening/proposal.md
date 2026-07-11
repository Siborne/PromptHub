# Project Module Boundary Hardening

## Why

PromptHub has accumulated production and test files above the 2,000-line hard limit, plus several modules approaching the preferred 1,500-line ceiling. These files mix policy, orchestration, adapters, state, rendering, and fixtures, increasing regression risk and making otherwise small feature work expand legacy god modules.

## Scope

- Inventory every non-generated source/test file at or above 1,400 lines.
- Enforce a one-way line-count ceiling for existing legacy files and a hard 2,000-line limit for new files.
- Refactor project modules by domain ownership and dependency direction, not arbitrary line ranges.
- Split oversized tests by public behavior and independent setup boundaries.
- Coordinate with existing active changes instead of creating competing architecture.

## Non-Goals

- Rewrite the whole application in one change.
- Change data ownership, persistence formats, IPC contracts, or user behavior merely to simplify a split.
- Move code into generic `utils` buckets or barrel files that preserve the same coupling.
- Refactor files currently changing under another active change without respecting its owner and tests.

## Delivery Strategy

Work lands as small independently verifiable refactors. Each stage must reduce or hold the legacy line baseline, preserve behavior, and leave the repository buildable. Existing active changes remain the source of truth for their domains.
