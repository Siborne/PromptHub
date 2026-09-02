# Implementation

Status: review-pending — real Windows packaged UI acceptance remains

## Implemented Changes

- Added one Git-first/HTTPS-archive fallback materializer shared by remote Skill
  install, fingerprint and snapshot paths. GitHub, GitLab.com and
  Gitea-compatible archive routes remain one deterministic attempt per source.
- Reused the existing bounded remote byte fetcher and safe ZIP extractor; the
  extracted checkout still enters the same selector, package validation,
  safety review, fingerprint, staging, replacement and rollback pipeline.
- Added `git-unavailable` and `git-http-fallback-failed` as additive bounded
  failure reasons under the existing `SOURCE_UNAVAILABLE` lifecycle code.
- Added localized terminal install/update copy and missing-Git guidance for
  custom-store branch discovery while preserving manual branch entry.
- Extended the stable Skill transport contract and added regression row
  `SR-035`.
- Added unit and real-filesystem fixtures for Git absence, clone failure, HTTP
  success, dual failure, credentials, SSH exclusion, GitLab/default refs,
  malformed archive roots, unsafe archives, complete package inventory,
  cleanup, lifecycle propagation and renderer copy.

## Verification

- Focused Vitest first pass: 193 assertions passed and one new real-filesystem
  fixture failed because jsdom-side dynamic ZIP generation retained only its
  binary entry. The fixture was replaced with a fixed four-file ZIP and only
  that affected test was rerun; it passed.
- Focused coverage pass: 7 files, 194 tests passed. New
  `skill-package-transport-error.ts` and `skill-git-error.ts` reached 100% line,
  branch and function coverage. `skill-installer-remote-package.ts` reached
  100% lines/functions and 97.97% branches; uncovered lines 92 and 373 are
  unchanged legacy fallback branches for default source-key formatting and a
  repository-root snapshot path.
- `pnpm --filter @prompthub/desktop typecheck`: passed.
- Focused ESLint over all changed source/test files: passed with zero warnings.
- Focused Prettier check passed after mechanically formatting only nine
  task-owned files; pre-existing dirty locale edits were not reformatted.
- `pnpm lint:file-size`: passed; new files remain below limits and legacy files
  did not grow beyond the enforced ceiling.
- Desktop i18n regression: 5 files, 42 tests passed.
- `pnpm build`: passed for renderer, main and preload production bundles.
- `git diff --check`: passed.
- `pnpm spec:traceability`: passed for 15 active changes.
- `pnpm spec:index:check`: passed with no change-index drift.
- Live HTTP fallback smoke: with the running Node process `PATH` set to an
  intentionally nonexistent directory, `mattpocock/skills` `ask-matt` installed
  through the real GitHub archive endpoint into an isolated temporary user-data
  root and contained `SKILL.md`. The temporary root was removed afterward.

## Validation Boundary

- A real Windows x64 packaged build was not launched or controlled. The user
  did not authorize GUI/computer control in this request, and this macOS host
  cannot prove Windows PATH inheritance or packaged toast layout.
- The change therefore remains review-pending rather than archived. Exit
  condition: install one GitHub store Skill on a clean Windows packaged build
  without Git, then force both Git/HTTP failure and confirm the localized
  recovery message and manual-branch hint in the running UI.

## Static Audit Findings

- Git-backed Skill install/update/check share the same remote package adapter
  and are addressed together.
- Branch discovery remains Git-only because archive download cannot enumerate
  refs; missing Git now receives localized recovery guidance while manual branch
  entry remains available.
- Plugin HTTPS Git import has actionable Git copy but no archive fallback; it is
  a separate package-domain follow-up recorded as `ISS-20260902-001`.
- CLI Skill Git install and Git backup/push operations are intentionally not
  changed by this Desktop package-materialization fix; their explicit
  prerequisite/fallback decision is also tracked by `ISS-20260902-001`.
- Remote Git package tests did not cover an absent ambient Git executable plus
  a successful alternative transport.

## Issue State

GitHub issue #211 is closed after the reporter confirmed that installing Git
restores current behavior. This change improves the product so Git absence is
recoverable for eligible HTTPS sources and actionable otherwise. Local issue
snapshot files were already modified before this change and are not overwritten
without a conflict-free convergence step.
