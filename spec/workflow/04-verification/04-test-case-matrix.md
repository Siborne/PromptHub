# Test Case Matrix

## Stable Inventory

| Surface              | Core cases                                                                     | Primary assets                                                | Current gap policy                                      |
| -------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------- |
| Database/migration   | fresh schema, existing-user migration, constraints, rollback, reload           | `packages/db`, desktop DB unit tests                          | changed migration branches require real SQLite coverage |
| Filesystem/workspace | atomic write, traversal, symlink, partial failure, rescan                      | desktop main/core tests                                       | use temp directories and durable side-effect assertions |
| Skill lifecycle      | source identity, package inventory, install/update/delete/distribute, conflict | `skill-defect-taxonomy.md`, `skill-regression-test-matrix.md` | every defect maps to the domain matrix                  |
| Plugin/MCP lifecycle | manifest/config parsing, target inventory, distribution, cleanup, sync         | plugin/MCP core, main, store, component tests                 | adapter and target matrices must remain explicit        |
| IPC/API/CLI          | validation, shared contract, error propagation, serialization                  | preload/IPC, route, CLI tests                                 | mocks may not hide contract shape failures              |
| Sync/backup/recovery | snapshot completeness, merge/replace, conflict, partial failure                | sync services and release harness                             | all durable data types require round-trip proof         |
| Renderer UI          | action semantics, loading/empty/error/conflict, stale async result             | component tests and browser/desktop interaction               | visible changes require real interaction evidence       |
| Release/package      | exports, typecheck, lint, unit/integration, build, manifest, installer         | `scripts/verify-release.mts`                                  | only the full harness grants release approval           |

## Maintenance Rule

Active changes add rows or link domain-specific matrices when they introduce a
new durable risk category. One-off test progress does not belong here.
