# React Type Workspace Boundary Delta

## Requirements

### `FR-CI-001`: Deterministic mixed-React type resolution

Clean frozen-lockfile installs MUST resolve React 18 types for the public-hoisted
Desktop and self-hosted Web dependency graph while retaining React 19 types in
the mobile workspace. Desktop and Web typechecks MUST NOT depend on prior local
install order.

## Acceptance Criteria

- `AC-CI-001`: The root manifest and lockfile pin React 18 types.
- `AC-CI-002`: Mobile retains its explicit React 19 type declaration.
- `AC-CI-003`: A fresh release workflow passes Desktop and Web typechecks before
  starting all platform package builds.
