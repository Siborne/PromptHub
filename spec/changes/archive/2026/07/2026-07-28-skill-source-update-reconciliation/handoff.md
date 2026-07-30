# Handoff: Skill Source Update Reconciliation Review

## Review Goal

Review the design-only active change for Skill source update reconciliation before implementation begins, after the first external review decisions have been applied.

This handoff is intended for another agent or reviewer. The prior eight reviewer questions now have recorded decisions; focus the next review on consistency, missing edge cases, and implementation readiness.

## Current State

The active change is documentation-only. No production code has been changed for this feature.

Primary files:

- `proposal.md`
- `specs/skills/spec.md`
- `design.md`
- `tasks.md`
- `implementation.md`

Relevant stable docs and code to compare:

- `spec/knowledge/behavior/skills.md`
- `spec/knowledge/reference/skill-regression-test-matrix.md`
- `spec/knowledge/structure/skill-system-design.md`
- `spec/knowledge/structure/skill-store-requirements.md`
- `packages/shared/utils/skill-identity.ts`
- `apps/desktop/src/renderer/services/skill-store-update.ts`
- `apps/desktop/src/renderer/stores/skill.store.ts`
- `apps/desktop/src/main/ipc/skill/local-repo-handlers.ts`

## Proposal Summary

The proposed model treats Skill update as three-way reconciliation:

```text
B = last successful source baseline
L = current local My Skills package
R = current source package
```

It introduces package-level baseline fields such as `installed_directory_fingerprint`, status rows such as `baseline-missing` and `source-unavailable`, and a versioned package fingerprint algorithm such as `skill-package-sha256-v1`.

The design intentionally separates:

- source identity from display name
- source origin from project/agent install mode
- source update from downstream copy redistribution
- linked local source from PromptHub-managed copy import

## Self-Review Findings

### Finding 1: The Design Correctly Identifies The Major Current Gap

Current DB state has `directory_fingerprint` for the current local package and `installed_content_hash` for the last installed `SKILL.md` content. It does not have a durable baseline for the full package.

That means non-`SKILL.md` resource updates cannot be safely reconciled as `localModified` versus `remoteChanged`. Adding `installed_directory_fingerprint` is the right direction.

### Finding 2: Hash Algorithm Migration Decision Is Now Explicit

The design now requires `skill-package-sha256-v1` in v1 and one shared `fingerprint_algorithm` column for current and installed package fingerprints.

Legacy installs are silently upgraded only when the old `installed_content_hash` or local `SKILL.md` hash matches the resolved remote `SKILL.md` hash. If that proof is absent, the state is `baseline-missing`.

### Finding 3: `source-moved` Is Deferred From v1

The design no longer includes `source-moved` in `SkillSourceUpdateStatus`. Canonical source identity changes are handled as manual detach/rebind or `baseline-missing` until a future lineage design exists.

### Finding 4: `baseline-missing` UX Is Defined For v1

The user-facing title is “无法确定修改历史 (Unable to reconcile history)”. The dialog explains that PromptHub cannot safely determine whether local files were edited after an older-version upgrade, and offers:

- “保留本地修改并建立基准” / Keep local changes as new baseline.
- “重置为来源版本（覆盖本地）” / Reset from remote source.
- “解除与来源的绑定” / Detach from source.

### Finding 5: `downstream-stale` Is Decoupled

The design removes `downstream-stale` from `SkillSourceUpdateStatus`. Downstream stale copies are distribution/topology data, surfaced through `hasStaleTargets` and `staleTargets` on `SkillSourceUpdateCheck` or through project/agent scan rows.

### Finding 6: Linked Local Source Update Boundary Is v1-Blocking

For linked imports, the external folder is the content source of truth. Updating from a remote source into that external folder is materially different from updating a PromptHub-managed copy.

The design now blocks direct remote overwrite for `local-linked` external folders in v1. The UI must direct users to convert to a PromptHub managed copy before updating, or manually pull/update in their external editor or VCS tool.

### Finding 7: Symlink Handling In Package Fingerprint Is Ambiguous

The design says symlink entries can be represented as `symlink:<relativePath>:<target>` if allowed, otherwise excluded with a safety finding.

Review what PromptHub should do for Skill packages containing symlinks:

- include symlink metadata in fingerprint;
- reject packages with symlinks from remote sources;
- ignore symlinks for fingerprint but surface safety warning;
- follow symlinks only inside package root.

The choice has security and cross-platform consequences.

### Finding 8: Ignore Rules Are Good But Need Fixture Coverage

Current ignore behavior already excludes `.env` and `.env.*` except `.env.example`, `.env.sample`, and `.env.template`.

Review that tests cover:

- `.env.local` ignored;
- `.env.production` ignored;
- `.env.example` included;
- `.prompthub/` ignored;
- `.git/` ignored;
- `node_modules/` ignored;
- hidden distributable file included;
- cache/log/temp files ignored;
- binary assets included.

### Finding 9: Source Resolver Security Must Be Explicit In Implementation

The design mentions remote Git, remote zip, raw content URL, and remote store. Implementation must preserve or strengthen:

- proxy behavior;
- SSRF/internal URL protections;
- path traversal prevention in zip extraction and Git directory copy;
- max package size and file count limits;
- validation that exactly one intended `SKILL.md` root is applied;
- sanitized error storage in `source_last_error`.

The reviewer should verify these are explicit implementation tasks before coding.

## External Review Decisions Applied

1. Durable package fingerprint uses `skill-package-sha256-v1` immediately in v1.
2. One `fingerprint_algorithm` column describes both current and installed package fingerprints.
3. `downstream-stale` is distribution/topology data, not a source status.
4. `local-linked` external folders cannot be remotely overwritten in v1.
5. `source-moved` is a future feature and not part of v1 status mapping.
6. `baseline-missing` uses the “无法确定修改历史 (Unable to reconcile history)” dialog and three explicit user choices.
7. Raw `content-url` is a single-file package whose package fingerprint equals normalized content hash.
8. Safety scan runs after staging materialization and before atomic replace; high-risk findings abort and cleanup staging.

## Remaining Review Points

- Decide final remote symlink policy before implementation.
- Verify package size, file count, binary file, zip traversal, and SSRF protections are explicit enough in implementation tasks.
- Confirm whether the initial implementation needs a compare/diff UI inside `baseline-missing`, or whether the three resolution actions are enough for v1.

## Recommended Review Order

1. Read `specs/skills/spec.md` first to inspect requirements and scenarios.
2. Read `design.md` next and challenge data model and state ownership.
3. Read `tasks.md` to check whether every risky design point has a test and implementation task.
4. Compare with `packages/shared/utils/skill-identity.ts` and `apps/desktop/src/renderer/services/skill-store-update.ts`.
5. Compare with plugin source update behavior in `packages/core/src/plugin-library.ts`, because Plugin already has package baseline semantics.

## Minimum Accept Criteria Before Implementation

- Baseline fields and algorithm migration remain consistent across `spec.md`, `design.md`, tasks, and future DB migration.
- `downstream-stale` remains outside the source status enum in all planned contracts.
- Linked local source overwrite remains blocked for v1 implementation.
- `source-moved` remains deferred until a future lineage design exists.
- Test tasks include DB migration, fingerprint ignore fixtures, source resolver failures, rollback, and UI status actions.

## Current Worktree Note

At the time this handoff was written, this active change is uncommitted and documentation-only.
