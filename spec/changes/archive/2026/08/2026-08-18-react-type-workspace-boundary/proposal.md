# React Type Workspace Boundary

## Why

The clean Linux release verifier installed React 19 types at the public-hoisted
workspace boundary while Desktop and self-hosted Web still compile against
React 18. Local incremental installs happened to hoist React 18 types, so local
typechecks passed while release run `31790557036` failed before the platform
build matrix started.

## Scope

- Pin React 18 and React DOM 18 type packages at the monorepo root.
- Preserve the mobile app's workspace-local React 19 type dependency.
- Add a governance regression for the mixed React workspace boundary.
- Re-run the release workflow from a clean install.

## Non-Goals

- Migrating Desktop or Web to React 19.
- Downgrading the mobile app from React 19.
- Removing pnpm public hoisting in this release batch.

## Risk And Rollback

The root pins affect type resolution only and do not change shipped React
runtimes. Rollback would restore nondeterministic clean-install type selection
and is not release-safe while the workspace mixes React majors.
