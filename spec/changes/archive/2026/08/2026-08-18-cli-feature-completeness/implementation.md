# Implementation

## Status

Completed and converged. Code, focused CLI verification, the quick release
harness, scoped review, and submission are complete. The 2026-08-18 lifecycle
audit found no remaining change-owned task or worktree edit.

## Shipped

### Feature completeness

- Workspace/sync snapshots include `skillFiles`, `promptRelations`, `outputFormatItems`
- Web sync payload validation accepts the added relation and output-format fields
- Clear path deletes relation and output-format rows
- Restore inserts folders/prompts parent-first for FK safety
- MCP `create` / `update` / `delete`
- Plugin resource: list/get/market/sources/install/delete/versions/create-version
- Prompt `--parent-id`, `relation *`, `output-format *`
- Skill `update` metadata + `check-update`
- README / docs CLI command tables updated

### Modular CLI layout (size gate)

`packages/core/src/cli/run.ts` was ~4300 lines and violated the 2000-line file limit. It is now a thin router. Commands and shared helpers live in focused modules. The previous `skill-cli-service.ts` implementation is now split under `skill/`, with the old path retained as a compatibility re-export. Command modules now import their owning dependencies directly rather than using a cross-domain barrel or importing types from `run.ts`.

```text
run.ts                 ~177   router only
types.ts               ~85
help.ts                ~329
io.ts                  ~141
args.ts                ~445
prompt-utils.ts        ~378   prompt parsing, diffs, and rendering
folder-utils.ts        ~91    folder parsing and presentation
rules-utils.ts         ~148   rules parsing and presentation
workspace-utils.ts     ~47    workspace and remote-sync options
select.ts              ~500   interactive selection and identity resolution
mcp-utils.ts           ~390
prompt-command.ts      ~518
folder-command.ts      ~102
skill-command.ts       ~591
mcp-command.ts         ~261
rules-command.ts       ~263
workspace-command.ts   ~187
plugin-command.ts      ~320
ai-config-command.ts   ~633
workspace-sync.ts      ~580
sync-command.ts        ~152
skill-cli-service.ts   1      compatibility re-export
skill/index.ts         3      public Skill module exports
skill/parse.ts         ~143   SKILL.md parsing and input validation
skill/paths.ts         ~348   path, repo, and traversal helpers
skill/install.ts       ~502   source acquisition and package installation
skill/service.ts       ~877   composed CliSkillService
```

CLI tests were also split by resource:

```text
run.test.ts                    ~994    routing, MCP, folder, workspace, and rules
prompt.test.ts                 ~604    prompt lifecycle and version commands
skill.test.ts                  ~953    Skill lifecycle, repo, safety, platform tests
skill-project-install.test.ts  ~202    project install and interactive selection
helpers/cli-harness.ts         ~84     isolated runtime and output harness
```

## Verification

- `pnpm --filter @prompthub/core typecheck` passed
- `pnpm --filter @prompthub/cli typecheck` passed
- `pnpm --filter @prompthub/cli exec vitest run tests/skill.test.ts tests/skill-project-install.test.ts` passed
- `pnpm --filter @prompthub/cli test` passed
- `pnpm verify:release:quick` passed

## Follow-ups

- Split `skill/service.ts` again before it reaches the 1000-line default target.

## 2026-08-18 Size Follow-up

Later CLI additions pushed `tests/run.test.ts` to 1,040 lines and
`tests/skill.test.ts` to 1,028 lines, invalidating the archived snapshot's
below-1,000 claim. Rules import/validation coverage and the shared Agent Skills
target lifecycle were extracted into focused test files; the original feature
remains complete and the size regression is corrected without reopening its
product scope.
