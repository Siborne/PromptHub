# React Type Workspace Boundary Design

## `DES-CI-001`: Root-owned public-hoist type selection

PromptHub uses `shamefullyHoist: true`, while Desktop and Web use React 18 and
mobile uses React 19. Transitive declarations such as Lucide and React Router
resolve `@types/react` from the public-hoisted workspace boundary. The root
therefore owns an exact React 18 type pin; Desktop and Web keep their own React
DOM 18 types, and pnpm continues to place mobile's explicit React 19 types
within the mobile workspace. Transitive wildcard declarations may reuse the
public React 18 default, while mobile source resolves its explicit workspace
React 19 declaration.

No runtime package, source component, or TypeScript suppression is changed.
The governance test reads package manifests and the workspace hoist setting in
`O(1)` time so a future dependency update cannot silently remove the boundary.

| Requirement | Design       | Verification  | Task       |
| ----------- | ------------ | ------------- | ---------- |
| `FR-CI-001` | `DES-CI-001` | `TEST-CI-001` | `T-CI-001` |
