# 0.6.0-beta.1 Replacement Candidate Scope

Scope frozen on 2026-08-19 for the maintainer-authorized same-version
replacement. This record distinguishes what the replacement claims from active
future work that remains outside the beta contract.

## Included Candidate Deltas

- The completed Windows `0.5.9` packaged-upgrade startup gate and its bounded
  process/profile cleanup.
- File-authoritative canonical startup and recovery slices completed after the
  withdrawn candidate: Prompt/Folder ordering, recovery candidates, media
  restoration, derived catalog reconciliation, AI model config recovery, and
  legacy Agent Skill link reconciliation.
- Completed Agent workspace corrections: owner-derived asset summaries, native
  menu quota projection, native config editor surface hierarchy, and their
  focused regressions.
- Completed Rules/MCP file-authority and persistence safety slices already
  represented in stable knowledge and active change records.
- Behavior-preserving line-limit splits for renderer AI/Prompt surfaces, Core
  MCP persistence, canonical recovery helpers, macOS injector orchestration,
  Prompt workspace helpers, and CLI tests.
- Lifecycle convergence that archives completed/backlog records while keeping
  real implementation, verification, release, and external gates active.
- Release documentation, seven localized README surfaces, website changelog,
  and the same-tag draft replacement contract.

## Explicitly Not Claimed

- Future Provider Profile binding/protocol conversion work, unfinished Web
  Agent parity, Cloud collaboration, marketplace expansion, or other accepted
  backlog designs.
- A native iOS/Android store release. Mobile source/type/test/export checks
  remain part of the repository release harness, but this Desktop/CLI/Web beta
  does not claim App Store or Play Store publication.
- R2 preview mirroring. The R2 publisher remains stable-only; beta assets stay
  on the tag-specific GitHub prerelease.
- Automatic activation of the experimental shared Agent Skills target. It
  remains opt-in, excluded from defaults, and compatibility-gated.
- Closure of GitHub issues merely because a local implementation is included.
  Issue state changes only after the replacement prerelease is public and its
  contents are verified.

## Worktree Audit

- The pre-commit audit found only source, test, configuration, spec, and archive
  changes. No untracked file exceeded 1 MiB.
- High-confidence private-key, GitHub token, AWS key, Slack token, and OpenAI
  key patterns found no secret-bearing file; `risk-aware` text produced the
  only `sk-` substring false positive.
- `apps/web/.env` remains ignored by the repository and is not a candidate
  file. Build outputs under `dist/`, `out/`, and `output/` remain ignored.
- The lifecycle archive contains complete source-to-destination file sets; the
  archive audit records intentional status/convergence edits rather than
  silent deletion.

## Current Verification State

- Same-tag release workflow contract: 1 file / 8 tests passed.
- Skill UI integration fixture repair: 1 file / 11 tests passed.
- Complete Desktop Vitest: 610 files / 5,434 tests passed in 664.42 seconds.
- `pnpm verify:release:quick`: 29/29 checks passed in 1,230.1 seconds with a
  maximum concurrency of two and no task-owned process or port leak.
- `pnpm verify:release`: 42/42 checks passed in 796.3 seconds with zero failed
  or blocked checks. Performance, Desktop integration/build/bundle/E2E,
  CLI/Web builds, Web smoke, Cloudflare dry-run and Mobile gates passed.
- Isolated Agent config-files E2E passed. The wider Agent workspace E2E passed
  after its test interaction was aligned with the already-shipped provider-row
  activation switches and made to await the asynchronous activation plan. The
  inspected config screenshot shows the intended gray tree / white editor
  contrast; no matching public screenshot asset exists.
- Final tag-triggered Desktop Release run `32265536666` passed the complete
  platform matrix. The release job verified hashes and refreshed all 20 draft
  assets; independent checks then confirmed the tag target, updater manifests,
  public asset URLs, GHCR isolation, and stable Latest boundary.

## Completed Mutation Boundary

The candidate commits were pushed to `main`; the annotated tag was moved with
an expected-old-value lease to commit
`6c08b5e84d70ecb41b32030b00e2e04fae96319a`; the existing draft assets were
replaced in place; and the verified draft was explicitly promoted as a public
prerelease on 2026-08-19. `T-WINSTART-008` is complete.
