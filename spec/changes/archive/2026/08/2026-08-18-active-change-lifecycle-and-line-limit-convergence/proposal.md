# Active Change Lifecycle And Line-Limit Convergence

## Phase And Status

- Phase: converge
- Status: completed and ready for dated archive
- Scope: active-change lifecycle audit and behavior-preserving large-file splits

## Why

The active change inventory contains completed work beside unfinished and
release-gated work, which makes the active set unreliable as a description of
current execution. The repository also carries one-way file-size baselines for
several source files close to the 2,000-line hard limit.

## Scope

- Classify every current active change from its tasks, implementation evidence,
  recorded blockers, release conditions, stable-doc synchronization, and
  worktree state.
- Archive only changes whose implementation, verification, documentation, and
  convergence evidence are complete.
- Keep unfinished, review-gated, release-gated, or inconsistent records active
  and record their exact exit condition.
- Split governed legacy source files above the 1,500-line preferred ceiling by
  responsibility without changing public behavior or ownership boundaries.
- Regenerate the authoritative change inventory and reduce the one-way
  file-size baseline as files shrink.
- Recheck previously archived CLI work against current files and tests instead
  of relying on the historical checkbox state.
- Split touched CLI test hotspots that have regrown beyond the 1,000-line
  default and split any currently modified file that exceeds the enforced
  1,500-line ceiling.
- Verify remote release state before treating publication-gated records as
  complete.

## Non-Goals

- Completing product features that remain open in another active change.
- Publishing a release, closing GitHub issues, or committing/pushing work.
- Rewriting historical change content merely to match the current template.
- Refactoring files already at or below the preferred ceiling without a direct
  dependency from the required splits.

## Risks And Rollback

- A false-positive archive can hide unfinished work. Each archive decision
  therefore requires completed tasks plus implementation, verification,
  stable-doc, and convergence evidence; release-pending work stays active.
- Code motion can change exports, initialization order, or UI behavior. Existing
  public entry modules remain compatibility facades and focused behavior tests
  protect the moved responsibilities.
- Archive moves are reversible directory moves. Code splits are reversible by
  restoring the facade implementation; no schema, user-data, or IPC contract is
  changed.

## Analyze Result

- Lifecycle ownership agrees across `AGENTS.md`, the PromptHub `spec-init`
  profile, and `spec/rules/change-management-rules.md`.
- The requested refactor is behavior-preserving and does not change durable
  state ownership.
- Existing dirty recovery work in `main/index.ts` and `mcp-library.ts` is
  preserved and treated as the starting state, not reverted.
- The current `prompt-workspace.ts` recovery edits are also preserved;
  restore-marker persistence is a cohesive internal boundary that can move to
  a sibling module without changing DB/filesystem source of truth.
- No blocking design conflict or `[待确认]` remains.
