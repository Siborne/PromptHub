# Implementation

## Status

Implementation and focused verification completed for GitHub issue #183. The fix shipped in `0.5.9`, and the issue is closed.

## Source Of Truth

- Durable content: the existing Skill package `SKILL.md` file.
- DB-owned editable metadata: current Skill database fields.
- File-owned preserved metadata: `allowed-tools`, `metadata`, and unknown frontmatter extension fields.

## Verification

- Red phase: the first focused Desktop run failed 5 new regressions, proving block scalar truncation, missing `allowed-tools`, unsafe partial parsing, and destructive repo rewrite behavior.
- Follow-up red phase: the repo-sync regression exposed normalized compatibility arrays being collapsed into one comma-delimited item; the rewrite now retains the original raw YAML value.
- Same-class audit red phase: five remaining consumers failed on Web remote import, GitHub CRLF input, ClawHub block values, skills.sh indentation, and detail frontmatter containing `---` inside a scalar.
- `pnpm --filter @prompthub/core test -- --coverage --coverage.include='src/skills/skill-frontmatter.ts' --coverage.reporter=text`: 8 tests passed; 100% statements, branches, functions, and lines.
- Focused Desktop parser/export/repo-sync/installer suite: 277 tests passed.
- Focused CLI frontmatter and Skill suite: 15 tests passed.
- Focused Web remote Skill suite: 10 tests passed.
- Focused Desktop marketplace and detail suite: 42 tests passed.
- `pnpm --filter @prompthub/core typecheck`: passed.
- `pnpm --filter @prompthub/desktop typecheck`: passed.
- `pnpm --filter @prompthub/cli typecheck`: passed.
- `pnpm --filter @prompthub/web typecheck`: passed.
- `pnpm --filter @prompthub/desktop build`: passed.
- `pnpm --filter @prompthub/web build`: passed for client and server bundles.
- `pnpm verify:release:quick`: reached Desktop unit tests after shared/db/core typecheck, CLI lint/typecheck/tests/build, and Desktop lint/typecheck passed. The Desktop unit stage failed on 8 unrelated existing regressions: four duplicate-text queries in `skill-batch-deploy-dialog.test.tsx` and four 30-second timeouts in `skill-installer-remote-git-package.test.ts` under full-suite load. All #183-focused tests passed inside the same run.

## Documentation Sync

- Stable Skill behavior now records the shared YAML contract, standard fields, preservation behavior, and safe-failure rules.
- Regression matrix `SR-020` records the escaped destructive rewrite bug.
- Active issue overlay is marked `released` after the published `0.5.9` replacement.

## Implementation Result

- Added `packages/core/src/skills/skill-frontmatter.ts` as the sole PromptHub SKILL.md YAML boundary using the `yaml` core schema.
- Parser results expose normalized standard fields plus raw frontmatter for extension preservation.
- Desktop metadata-only rewrites merge DB-owned fields into the existing raw frontmatter and retain the Markdown body.
- File-owned scalar and collection shapes, including multi-value `compatibility`, are not round-tripped through the lossy normalized UI view.
- CLI export reuses the shared serializer and preserves file-owned fields when its input contains a complete `SKILL.md`.
- Web remote import, GitHub, ClawHub, skills.sh, and Skill detail metadata now use the shared parser instead of regex or line-based YAML subsets.
- skills.sh embedded SKILL.md extraction preserves indentation so block scalars and block lists remain valid YAML.
- No SQLite schema, filesystem layout, IPC, or migration change was required.
