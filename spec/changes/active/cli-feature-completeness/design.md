# Design: CLI Feature Completeness

## Approach

1. Keep `apps/cli` as a thin entrypoint. Logic stays in `packages/core/src/cli/*`.
2. Extend `SyncSnapshot` with optional `promptRelations` and `outputFormatItems`.
3. `createCliWorkspaceBundle` / `restoreCliWorkspaceSnapshot` / `clearCliWorkspaceData` own snapshot fidelity.
4. Keep `run.ts` as a thin resource router. Prompt, folder, skill, MCP,
   plugin, rules, workspace, sync, and AI commands live in focused modules.
5. Split the CLI Skill implementation by ownership:
   - `skill/parse.ts` for metadata parsing and validation
   - `skill/paths.ts` for path and repository traversal boundaries
   - `skill/install.ts` for source acquisition and package installation
   - `skill/service.ts` for the composed `CliSkillService`
   - `skill-cli-service.ts` remains a compatibility re-export
6. Split CLI tests by resource. The shared harness owns temporary runtime,
   output capture, and isolated data-directory setup; each test module owns a
   single command domain and remains below the 1000-line default limit.
7. Keep command dependencies explicit. `run.ts` and command modules import
   their owning parser, presentation, selector, and service modules directly;
   do not use a cross-domain utility barrel.
8. Keep command-domain helpers with their resource: prompt helpers remain in
   `prompt-utils.ts`, while folder, rules, and workspace helpers have focused
   modules. `select.ts` owns interactive selection and identifier resolution.

## Traceability

| Requirement   | Design        | Verification   | Tasks            |
| ------------- | ------------- | -------------- | ---------------- |
| `FR-CLI-001`  | `DES-CLI-001` | `TEST-CLI-001` | `T1`, `T2`, `T8` |
| `FR-CLI-002`  | `DES-CLI-002` | `TEST-CLI-001` | `T3`, `T8`       |
| `FR-CLI-003`  | `DES-CLI-003` | `TEST-CLI-001` | `T4`, `T8`       |
| `FR-CLI-004`  | `DES-CLI-004` | `TEST-CLI-001` | `T5`, `T8`       |
| `FR-CLI-005`  | `DES-CLI-005` | `TEST-CLI-001` | `T6`, `T8`       |
| `NFR-CLI-001` | `DES-CLI-006` | `TEST-CLI-002` | `T9`..`T12`      |

### Design decisions

- `DES-CLI-001`: Snapshot assembly, restore, and force-clear keep CLI-specific
  orchestration in `packages/core/src/cli/workspace-sync.ts`; storage primitives
  remain in `packages/db` and snapshot contracts remain in `packages/shared`.
- `DES-CLI-002`: MCP command parsing and output stay in the CLI layer while
  shared MCP-library state remains owned by `packages/core`.
- `DES-CLI-003`: Plugin command parsing delegates to the existing shared plugin
  library and does not create a CLI-owned data store.
- `DES-CLI-004`: Prompt hierarchy, relation, and output-format commands use
  existing database ownership through explicit CLI command handlers.
- `DES-CLI-005`: Skill metadata and fingerprint operations are implemented by
  the composed `CliSkillService` rather than command-local filesystem code.
- `DES-CLI-006`: `run.ts` only routes; resource command modules import focused
  parser, selector, output, and service modules directly. Tests are grouped by
  command domain and share only the isolated CLI harness.

## Data

| Field             | Source                                              | Notes                                |
| ----------------- | --------------------------------------------------- | ------------------------------------ |
| skillFiles        | skill repos via `readCurrentFilesSnapshot`          | required for portable skill packages |
| promptRelations   | `PromptRelationDB.list()`                           | optional; restore after prompts      |
| outputFormatItems | `PromptOutputFormatDB.list()`                       | optional; restore after prompts      |
| clear tables      | prompts/folders/skills + relations + output formats | MCP/plugin/rules already separate    |

## Command surface delta

```text
mcp create|update|delete
plugin list|get|market|sources|install|delete|versions
prompt --parent-id
prompt relation list|create|update|delete
prompt output-format list|create|delete|reorder
skill update
skill check-update
```

## Verification

- Unit tests in `apps/cli/tests/*` for each new command path
- Workspace export/import round-trip with skillFiles, relations, output formats
- Existing CLI suite must remain green
- Core and CLI typechecks must pass after module extraction
- Command modules must not depend on `run.ts` types or a cross-domain utility
  barrel after the extraction
