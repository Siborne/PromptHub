# Implementation

## Status

- Status: implemented, verified, and submitted with the archived change record; release remains pending.
- Phase: converge

## Shipped

- Desktop CLI status detects the exact retired user-data wrapper through a bounded regular-file read and never executes it for version discovery. Standalone npm/pnpm installation rechecks and removes only that recognized wrapper after success.
- Direct Electron `--cli` invocation exits with migration guidance before updater registration, SQLite initialization, workspace migrations, or window creation.
- `prompthub doctor database-lock [--recover]` inspects lock and lease state without opening SQLite. Recovery is explicit and refuses live, unknown, symbolic-link, and non-directory ownership states.
- Skill local, JSON, and GitHub imports, managed copies, fingerprints, snapshots, project/platform distributions, and source updates share built-in ignores plus root `.prompthubignore` semantics. Root `SKILL.md` remains protected.
- Package mutation paths fail closed above 500 filtered entries, 2 MiB per text file, or 16 MiB cumulative text. High-confidence keys, provider tokens, and credential assignments are blocked with redacted diagnostics before durable side effects.
- GitHub imports use a unique temporary checkout, scan the selected Skill package, and atomically copy only the filtered package into managed storage. Replacement copies use staging and rollback rather than deleting a working target first.
- CLI success output uses bounded Skill summaries by default, `--full` preserves complete payloads, and `--quiet` suppresses only successful stdout. Preferred `import`, `distribute`, and `undistribute` names retain the legacy aliases.
- Desktop Skill details render upstream source, editable package ownership, and copy/symlink distribution targets as a compact responsive topology. All user-visible additions are localized across seven locales.
- The Desktop i18n script now references the existing renderer smoke suite instead of a removed test path.

## Verification

- Full standalone CLI suite: 12 files, 114 tests passed with two bounded workers.
- Focused CLI security/output/recovery coverage: 4 files, 44 tests passed. `doctor-command.ts`, `skill-output.ts`, core/shared package-policy modules reached 100% statements, branches, functions, and lines.
- Database lock module coverage reached 99.27% lines, 98.98% branches, and 100% functions. The only uncovered path is the pre-existing defensive `readLeasePid` branch for a lease file replaced between `readdir` and `lstat`; changed inspection and recovery decisions are covered.
- Core package scan-limit and atomic-copy regressions: 2 files, 4 tests passed.
- Focused Desktop coverage: 5 files, 24 tests passed. The new legacy invocation guard and Skill topology reached 100% statements, branches, functions, and lines. The complete legacy installer file reached 97.47% lines and 88.98% branches; uncovered paths are existing Windows resolver and generic fallback/error branches outside the changed wrapper lifecycle.
- Desktop topology E2E passed in light and dark themes at 1280x860 and 820x760. The responsive list stayed within its content bounds with no clipped or overlapping text.
- Built Desktop integration of `PromptHub --cli skill list` exited with code 2, printed migration guidance, and created no database or lock artifacts.
- Shared, DB, core, CLI, and Desktop TypeScript checks passed. Scoped CLI/Desktop ESLint checks passed.
- Standalone CLI production build passed: 196 modules transformed and `out/prompthub.cjs` produced successfully.
- Desktop production build passed after the responsive topology change. Its only warnings were the existing app chunk-size notice and existing `fflate` static/dynamic import notice.
- Seven locale files parsed successfully; the corrected Desktop i18n command passed 5 files and 36 tests. Public CLI guidance is present in all seven README variants.
- Spec governance, generated change-index consistency, and `git diff --check` passed.
- Repository file-size validation was executed but remains red on unrelated pre-existing `apps/desktop/tests/unit/services/database-backup.test.ts` at 1,511 lines against the preferred 1,500-line gate. No file touched by this change exceeds the project limits; new files remain below 1,000 lines.

## Analyze

- Traceability complete: yes.
- Conflicts/blockers resolved: explicit doctor recovery preserves the stable conservative CLI startup boundary; no other blocking conflict exists.

## Converge

- Stable behavior synced to the database concurrency, Desktop, and Skill knowledge records.
- Public CLI command, output, ignore, secret-scan, and doctor guidance synced across the seven README variants.
- No GitHub issue, release record, or ADR is required for this user-reported audit; the generated change index includes the review-pending record.
- Final lifecycle state: archived under `spec/changes/archive/2026/07/2026-07-16-cli-skill-automation-hardening/` with the scoped implementation submission.

## Synced Docs

- `spec/knowledge/behavior/database-concurrency.md`
- `spec/knowledge/behavior/desktop.md`
- `spec/knowledge/behavior/skills.md`
- `README.md` and `docs/README.{en,zh-TW,ja,fr,de,es}.md`

## Follow-ups

- Split the unrelated 1,511-line Desktop database backup test so the repository-wide preferred file-size gate returns green.
