# React Type Workspace Boundary Implementation

## Implemented

- Added an exact root development pin for `@types/react` 18.3.27 while retaining
  Desktop/Web React DOM 18 types and mobile's React 19 type declaration.
- Added a governance test that fixes ownership of the public-hoisted type
  boundary and documents the mixed-major workspace intent.

## Verification

- Release run `31790557036` reproduced the clean-install failure in Desktop and
  self-hosted Web typechecks before the build matrix.
- An isolated detached worktree completed `pnpm install --frozen-lockfile
  --offline` and Desktop, Web, and mobile typechecks. The resolved workspace
  type versions were React 18.3.27 at root/Desktop/Web and React 19.2.17 in
  mobile.
- All 29 checks in `pnpm verify:release:quick` passed with the corrected lockfile.
- The replacement full release workflow is pending.
