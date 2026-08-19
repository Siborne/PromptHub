# Lifecycle And Line-Limit Convergence Implementation

## Status

- Phase: converge
- Status: completed and ready for dated archive

## Lifecycle Result

The original inventory contained 60 active changes. Three evidence passes
removed 33 records that did not represent current implementation, review, or
release work:

- Eight locally complete records were archived in the initial pass.
- Sixteen accepted backlogs, superseded umbrellas, paused work without a source
  tree, and completed records with optional or obsolete task text were routed
  out of active in the second pass.
- Nine more completed records were archived after later commits, stable-doc
  synchronization, issue routing, and hosted CI evidence proved their remaining
  checkboxes stale.

After this audit record returns to the archive, 27 active changes remain: 12
with implementation work, five with verification or correctness convergence,
and ten with a release or external gate. `lifecycle-audit.md` is the
authoritative per-record classification.

The broad legacy type-escape cleanup formerly attached to the completed
renderer coverage campaign is now tracked as quality issue `Q-006`. Stable
desktop shell behavior was synchronized to
`spec/knowledge/behavior/desktop.md`.

## CLI Convergence

- Git history proves `cli-agent-management` shipped in commit `7d0b2043`; its
  archived task record no longer says it must remain active while uncommitted.
- Later changes grew `apps/cli/tests/run.test.ts` to 1,040 lines and
  `apps/cli/tests/skill.test.ts` to 1,028 lines, contradicting the archived CLI
  size statement.
- Rules import/validation coverage moved to
  `rules-import-validation.test.ts`; shared Agent Skills target coverage moved
  to `skill-shared-target.test.ts`.
- The two original suites are now 952 and 973 lines. The extracted suites are
  110 and 76 lines. Production CLI behavior did not change.

## Prompt Workspace Convergence

The current recovery work grew `prompt-workspace.ts` to 1,504 lines, which
failed the enforced 1,500-line gate. Restore-marker path resolution, write,
existence, and cleanup now live in `prompt-workspace-restore-marker.ts`.
`prompt-workspace.ts` remains the public facade and re-exports
`writeRestoreMarker` for compatibility.

After formatting, the entry file is 1,491 lines and the extracted module is 43
lines. This
does not add a filesystem pass, DB operation, network request, process, port,
or durable data format. Restore-marker operations retain their bounded `O(1)`
time and space behavior.

## Release Evidence

Read-only GitHub metadata on 2026-08-18 showed:

- `v0.5.9` is published with assets but marked as a prerelease;
- GitHub Latest stable still resolves to `v0.5.8`;
- `v0.6.0-beta.1` remains a draft prerelease after the Windows startup incident.

The public README currently describes `v0.5.9` as stable and uses
`releases/latest/download` URLs containing `0.5.9`. That mismatch is recorded
in the active republish change and `spec/releases/0.5.9.md`; neither remote
release metadata nor public download links were mutated by this audit.

## Verification

- The four affected CLI suites passed 36 tests. CLI TypeScript and scoped
  ESLint passed.
- The restore-marker regression passed through the unchanged
  `prompt-workspace.ts` export.
- The full Prompt workspace suite ran 20 tests and exposed three failures in
  the concurrent file-authoritative recovery slice: database-only Folder
  removal, missing-Folder rejection, and parent-first Prompt import. Those
  failures are recorded under the still-active
  `legacy-upgrade-recovery-audit`; they are not hidden by this completed
  extraction.
- Desktop TypeScript exposed another recovery-slice error in
  `src/main/index.ts`: the `CanonicalStorageAuthorityStartupResult` union is not
  narrowed before reading `reason`. This is also routed to the same active
  recovery change.
- Scoped Desktop ESLint, the file-size gate, CLI TypeScript, and
  `git diff --check` passed.
- The generated spec inventory/check, spec-init commit and governance rules,
  single-source check, and traceability validation passed before the archive
  move. The inventory check is repeated after the lifecycle destination changes.
- No full release build, packaging, E2E, or remote mutation was run because
  this batch changes only test ownership, one internal restore-marker seam,
  and lifecycle records. The active recovery change must restore its own full
  suite and Desktop typecheck before it can converge.

## Converge Destination

When final checks pass, this record moves to
`spec/changes/archive/2026/08/2026-08-18-active-change-lifecycle-and-line-limit-convergence/`.
