# PromptHub 0.6.0 Version Alignment Implementation

## Status

- Phase: converge
- Status: release-pending

## Shipped

- Root, Desktop, CLI, self-hosted Web, Cloudflare Worker, Mobile package, and
  Expo application manifests now report `0.6.0`.
- The project context in `AGENTS.md` now reports `0.6.0`.
- The standalone CLI runtime reports `0.6.0`.
- Website release synchronization now selects explicit stable release records
  instead of treating the root build version as published.
- The `0.6.0` preparation record and unreleased changelog note are synchronized.
- Public website badges, introduction copy, and download URLs remain on the
  published `0.5.9` stable release.

## Verification

- `TEST-REL-001`:
  - Command: exact manifest assertion over seven product version sources
  - Result: passed; every source reported `0.6.0`
- `TEST-REL-002`, `TEST-REL-003`, `TEST-REL-004`:
  - Command: `pnpm --dir website test:release-sync`
  - Result: 4 tests passed with 100% line, branch, and function coverage for
    `website/scripts/release-metadata.mjs`
- `TEST-REL-005`:
  - Command: `pnpm --dir website sync:release`
  - Result: passed; generated public release metadata remained `v0.5.9`
- CLI runtime:
  - Command: `pnpm --filter @prompthub/cli test -- tests/run.test.ts --run`
  - Result: 22 tests passed
- Type safety:
  - Commands: `pnpm --filter @prompthub/core typecheck`,
    `pnpm --filter @prompthub/cli typecheck`
  - Result: passed
- Website production build:
  - Command: `pnpm --dir website build`
  - Result: 13 pages built successfully; Browserslist reported stale advisory
    data without failing the build
- Specification and formatting:
  - Commands: `pnpm spec:test`, `pnpm spec:index:check`, targeted
    `prettier --check`, `git diff --check`
  - Result: passed
- Release quick gate:
  - Command: `pnpm verify:release:quick`
  - Result: 21 of 22 checks passed. The only failure is the pre-existing
    file-size gate for `SkillStore.tsx` and `SkillStoreDetail.tsx` at 1536
    lines each, above the preferred 1500-line limit. All shared, database, core,
    CLI, Desktop, Web, Worker, and Mobile typecheck/test/lint checks in the
    profile passed.

## Analyze

- Traceability complete: yes
- Conflicts/blockers resolved: yes; code/build version and published stable
  metadata use separate authoritative sources

## Converge

- Stable workflow/knowledge/rules synced: release rules already define the
  required stable-versus-preparation boundary
- Issues/releases/ADRs/indexes synced: `spec/releases/0.6.0.md`,
  `spec/releases/README.md`, and `spec/changes/index.md` updated; no issue or ADR
  state changed
- Final change destination: remain active until `0.6.0` publication

## Synced Docs

- `CHANGELOG.md`
- `website/src/content/docs/changelog.md`
- `spec/releases/0.6.0.md`
- `spec/releases/README.md`
- `AGENTS.md`

Localized README stable badges, download links, locale files, and screenshots
were intentionally left unchanged because `0.6.0` has not been published and
this change has no visible product UI delta.

## Follow-ups

- Tagging, signing, artifact publication, and remote verification are separate
  publication tasks and are not performed by this version-alignment change.
