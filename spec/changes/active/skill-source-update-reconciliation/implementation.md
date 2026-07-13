# Implementation

## Status

Implementation completed as of 2026-07-08 for the v1 scope. The implementation covers shared source update types, shared `B/L/R` reconciliation check construction, pure reconciliation classification, `skill-package-sha256-v1` package fingerprinting, content-url single-file snapshots, legacy baseline upgrade decisions, DB baseline columns, store update baseline writes, linked-local update blocking, source-unavailable error recording, project/agent copied target stale auxiliary reporting, renderer source resolver adapter classification, raw content-url package fingerprint normalization, staged remote package safety preflight, non-local remote source materialization before metadata baseline writes, managed repo staging/backup swap on partial copy failure, raw content-url pre-write safety scan and version rollback, SHA-256-labeled durable package fingerprint writes, and renderer UI messaging for blocked/baseline-missing/source-unavailable states.

## Documents Created

- `proposal.md`
- `specs/skills/spec.md`
- `design.md`
- `tasks.md`
- `implementation.md`
- `handoff.md`

## Code Added

- `packages/shared/types/skill.ts`: added shared source update status, snapshot, stale target, and update check types.
- `packages/shared/utils/skill-source-update.ts`: added pure source update reconciliation helpers, shared `buildSkillSourceUpdateCheck()` snapshot builder for `B/L/R` classification, sync/async SHA-256 package fingerprinting, content-url snapshot helpers, legacy upgrade decision helper, and linked-local action policy.
- `packages/db/src/schema.ts`, `packages/db/src/init.ts`, `packages/db/src/skill.ts`: added and persisted source baseline columns for fresh installs and existing-user migrations.
- `packages/db/src/init.ts`: backfills existing non-empty `directory_fingerprint` rows with `fingerprint_algorithm = legacy-stable-text-v1` so upgraded users do not silently reinterpret old stable-text values as SHA-256 package fingerprints.
- `apps/desktop/src/renderer/services/skill-store-update.ts`: updated store checks to construct source snapshots and delegate status classification to the shared reconciliation builder while preserving legacy package-resource update detection.
- `apps/desktop/src/renderer/services/skill-source-resolver.ts`: added the source resolver adapter boundary for remote store, remote Git, remote zip, raw content URL, local-linked, and managed-copy source kinds; raw content URLs are normalized as single-file packages whose package fingerprint equals fetched content hash.
- `apps/desktop/src/renderer/stores/skill.store.ts`: writes source baseline fields during install/update/refresh, blocks linked local overwrite updates, records sanitized `source_last_error` for source check failures, materializes non-local remote source updates before metadata/baseline writes, passes optional AI safety scan config to remote package materialization, safety-scans raw content-url updates before writing, rolls back raw content-url writes on final DB failure, derives ClawHub package/content URLs from installed page URLs when the store entry is absent, and attaches project/agent copied target stale reports to source checks through `hasStaleTargets` / `staleTargets`.
- `apps/desktop/src/main/services/skill-installer.ts` and `apps/desktop/src/renderer/services/github-skill-store.ts`: tree/API registry scans no longer derive `directory_fingerprint` from Git blob hashes; those paths leave the package fingerprint empty until a clone/materialized package can be hashed with `skill-package-sha256-v1`.
- `packages/shared/utils/skill-identity.ts`: confirmed as the centralized ignore/fingerprint predicate used by desktop main, renderer, and CLI paths; it ignores local env/runtime/cache output while preserving distributable templates such as `.env.example`.
- `packages/core/src/cli/skill-cli-service.ts`: records `fingerprint_algorithm` for CLI package fingerprint writes, records installed baseline fields for source-backed CLI installs, and computes durable package fingerprints with the shared SHA-256 v1 package manifest utility.
- `apps/desktop/src/main/services/skill-repo-sync.ts`, `apps/desktop/src/main/ipc/skill/local-repo-handlers.ts`, `apps/desktop/src/main/ipc/skill/version-handlers.ts`, and `apps/desktop/src/main/services/skill-installer.ts`: record `fingerprint_algorithm` when main-process DB writes refresh package fingerprints and compute durable package fingerprints with the shared SHA-256 v1 package manifest utility.
- `apps/desktop/src/main/services/skill-safety-scan.ts`: added deterministic preflight scanning reusable without AI configuration.
- `apps/desktop/src/main/services/skill-installer.ts`: runs staged remote git/zip package preflight before copying into the managed repo; blocking findings leave the previous repo intact.
- `apps/desktop/src/main/services/skill-installer-repo.ts`: `saveToLocalRepoBySkillId()` now copies into a staging directory and swaps with a backup so partial copy or sidecar write failures preserve the previous managed repo.
- `apps/desktop/src/main/ipc/skill/local-repo-handlers.ts` and `apps/desktop/src/preload/api/skill.ts`: allow optional staged package safety scan config for remote package saves.
- `apps/desktop/src/renderer/components/skill/SkillFullDetailPage.tsx` and `apps/desktop/src/renderer/components/skill/SkillStoreDetail.tsx`: added user guidance for baseline-missing/source-unavailable/no-source and linked-local blocked updates.
- `apps/desktop/tests/unit/services/skill-source-update-reconciliation.test.ts`: added TDD coverage for the core status matrix, stale target auxiliary reporting, legacy upgrade decisions, linked-local blocking, SHA-256 package fingerprinting, and raw content-url snapshots.
- `apps/desktop/tests/unit/services/skill-source-resolver.test.ts`: added adapter classification coverage for remote zip, remote Git, raw content URL, local-linked, and managed-copy sources, plus the raw content-url stale directory fingerprint regression.
- `apps/desktop/tests/unit/services/github-skill-store.test.ts` and `apps/desktop/tests/unit/main/skill-installer.test.ts`: added regressions proving GitHub/Gitea tree/API scans do not expose legacy blob-hash manifests as package fingerprints.
- `apps/desktop/tests/unit/main/skill-source-update-db.test.ts`: added DB schema/migration/persistence coverage for source baseline fields.
- `apps/desktop/tests/unit/main/skill-installer-remote-git-package.test.ts`: added staged remote zip safety preflight rollback coverage and partial copy failure rollback coverage for managed repo replacement.
- `apps/desktop/tests/unit/stores/skill.store.test.ts`: added package baseline install/update/refresh, source-unavailable sanitized error recording, remote package and content-url update failure ordering, materialized content-url rollback on final DB failure, raw content-url safety-scan blocking before write, project/agent stale copied target auxiliary reporting, full source status integration matrix coverage, proof that source updates do not mutate copied project/agent scan snapshots, raw content-url single-file fingerprint normalization, and linked-local blocked update coverage.
- `apps/desktop/src/renderer/services/clawhub-store.ts`: added shared ClawHub page URL parsing and API URL derivation helpers so installed ClawHub page sources can resolve to package zip updates without Git clone.
- `apps/desktop/src/renderer/i18n/locales/*.json`: added localized keys for baseline-missing, source-unavailable, no-source, and linked-local blocked update guidance.
- `spec/knowledge/behavior/skills.md`: synced stable source update reconciliation rules for package baselines, status boundaries, linked-local protection, remote package apply ordering, raw content-url safety/rollback, and sanitized source errors.
- `spec/knowledge/reference/skill-regression-test-matrix.md`: added required regression rows for remote package update failure ordering, source-unavailable sanitized errors, downstream stale reporting, content-url durability, raw content-url fingerprint normalization, and SHA-256-labeled durable fingerprint writes.
- `apps/desktop/tests/unit/components/skill-full-detail-async-actions.test.tsx` and `apps/desktop/tests/unit/components/skill-store-remote.test.tsx`: added linked-local guidance UI coverage and source update status action coverage for `up-to-date`, `update-available`, `conflict`, `baseline-missing`, `source-unavailable`, and `no-source`.

## 2026-07-13 Proxy Compatibility Follow-up

- `apps/desktop/src/main/services/skill-installer-remote.ts`: remote text and
  package-byte fetches now detect a configured request proxy before DNS
  validation. Proxy-generated RFC 2544 `198.18/15` compatibility answers are
  allowed for arbitrary public source hostnames, and the original hostname is
  passed to the proxy agent instead of the synthetic address. Real private
  addresses and direct requests retain the existing SSRF block.
- `apps/desktop/tests/unit/main/skill-installer-remote.test.ts`: added install
  and update regressions for proxy compatibility DNS answers, original-host
  routing, binary package fetches, and real private-address rejection.

## 2026-07-13 Source Diagnostics Follow-up

- `apps/desktop/src/renderer/services/skill-source-resolver.ts`: source
  diagnostics now resolve the adapter kind and a safe display reference for
  local directories, managed copies, Git, ZIP, content URL, and store sources;
  local metadata is preferred when old entries mix local and remote fields.
- `apps/desktop/src/renderer/services/skill-store-update.ts` and
  `apps/desktop/src/renderer/stores/skill/skill-source-update-workflow.ts`:
  `source-unavailable` checks now carry `sourceKind`, `sourceReference`, and a
  sanitized `sourceError` while preserving the existing durable
  `source_last_error` field.
- `apps/desktop/src/renderer/components/skill/skill-source-update-diagnostics.ts`,
  `SkillStoreDetail.tsx`, and `useSkillSourceUpdate.ts`: update feedback now
  identifies source type, path/address, and failure reason; source failures are
  shown as errors rather than generic informational toasts.
- Added resolver, local-source store, remote-source store, and detail toast
  regressions. Focused source tests (30 tests) and full-detail async action
  tests (22 tests) pass; desktop typecheck and Prettier checks pass.

## 2026-07-13 Agent Local Source Follow-up

- `apps/desktop/src/renderer/stores/skill/skill-library-actions.ts`: copied
  Agent imports now use an external symlink's concrete target for `source_url`
  and `source_id`; the Agent shortcut remains the local distribution path so
  rescan and uninstall behavior are unchanged.
- `apps/desktop/src/main/services/skill-package-validation.ts` and
  `apps/desktop/src/main/services/skill-installer-repo.ts`: local package
  validation, walking, and copying now apply the same shared ignore predicate
  as package fingerprints. `node_modules`, caches, runtime output, and local
  environment files therefore cannot make a valid Agent source fail package
  limits or pollute the managed copy.
- `apps/desktop/src/renderer/components/skill/SkillFullDetailPage.tsx` and
  `apps/desktop/src/renderer/components/skill/SkillDetailHeader.tsx`: managed
  non-builtin Agent details expose source check/update actions while retaining
  the restricted Agent management action set.
- Added regressions for ignored dependency files, ignored dependency copying,
  external symlink source binding, and Agent detail source actions.

Verification for this follow-up: the focused local-source suite passed with 11
test files and 190 tests; desktop TypeScript, ESLint, Prettier, and
`git diff --check` passed.

## 2026-07-13 Real Dev-Window Verification

- Started the desktop development environment with `pnpm --dir apps/desktop dev`; Vite served `http://localhost:5173/` and the Electron window loaded the renderer.
- Exercised the live user flow: `Skills` -> `Agent Skill` -> `Codex CLI` -> `opencode-cli` -> `在我的 Skill 中打开`.
- Clicked `检查来源更新` for the imported local Agent Skill. The UI displayed `已是最新` and retained the concrete local source `/Users/lingxiaotian/.codex/skills/opencode-cli`; it did not report the generic `来源暂时不可用` error.
- The development terminal also reported the expected cloud store feed network-unavailable diagnostic in this offline environment; it did not affect local source resolution or the successful local check.

## Current Findings

- Current Skill update detection already has the statuses `not-installed`, `up-to-date`, `update-available`, `local-modified`, and `conflict`.
- Current DB stores `directory_fingerprint` as the current local package fingerprint and `installed_content_hash` as entry content baseline.
- DB now stores `installed_directory_fingerprint`, `fingerprint_algorithm`, `source_last_checked_at`, `source_last_error`, and `source_binding_state`.
- Current `computeStableTextHash` is deterministic but not SHA-256. It remains a legacy identity helper for source ids, compatibility tests, and old-row comparison; durable package baselines labeled `skill-package-sha256-v1` use the shared v1 package manifest utility.
- Current ignore predicate already excludes `.env` and `.env.*` while preserving `.env.example`, `.env.sample`, and `.env.template`.

## Verification So Far

- `pnpm --dir apps/desktop exec vitest run tests/unit/main/skill-installer-remote.test.ts` (32 tests passed after proxy compatibility follow-up)
- `pnpm --dir apps/desktop exec vitest run tests/unit/main/skill-installer-remote.test.ts tests/unit/main/network-proxy.test.ts tests/unit/main/skill-installer-remote-git-package.test.ts tests/unit/services/skill-source-resolver.test.ts` (50 tests passed)
- `pnpm --dir apps/desktop exec vitest run tests/unit/stores/skill-store-source-checks.test.ts tests/unit/stores/skill-store-package-install.test.ts tests/unit/components/skill-store-remote-source-loading.test.tsx tests/unit/components/skill-store-remote-git-install.test.tsx` (51 tests passed)
- `pnpm exec eslint src/main/services/skill-installer-remote.ts tests/unit/main/skill-installer-remote.test.ts --report-unused-disable-directives --max-warnings 0` from `apps/desktop`
- `pnpm install --frozen-lockfile` restored the workspace dependencies required by the existing core package checks, then `pnpm --dir apps/desktop typecheck` passed.

- Documentation-only review of current source paths and stable docs.
- Applied external design review decisions covering SHA-256 fingerprint migration, downstream stale decoupling, linked local overwrite blocking, `source-moved` deferral, baseline-missing UX, raw content URL fingerprint behavior, and safety scan timing.
- `pnpm --dir apps/desktop exec vitest run tests/unit/services/skill-source-update-reconciliation.test.ts`
- `pnpm --dir apps/desktop exec vitest run tests/unit/stores/skill.store.test.ts tests/unit/services/skill-store-update.test.ts tests/unit/services/skill-source-update-reconciliation.test.ts tests/unit/main/skill-source-update-db.test.ts tests/unit/main/skill-installer-remote-git-package.test.ts tests/unit/main/skill-safety-scan.test.ts tests/unit/components/skill-full-detail-async-actions.test.tsx tests/unit/components/skill-store-remote.test.tsx`
- `pnpm --dir apps/desktop exec vitest run tests/unit/services/skill-identity.test.ts`
- `pnpm --dir apps/cli exec vitest run tests/run.test.ts`
- `pnpm --dir apps/desktop exec vitest run tests/unit/main/skill-repo-sync.test.ts tests/unit/main/skill-local-repo-ipc.test.ts tests/unit/main/skill-version-ipc.test.ts tests/unit/main/skill-installer-remote-git-package.test.ts`
- `pnpm --dir apps/desktop exec vitest run tests/unit/services/skill-store-update.test.ts tests/unit/services/skill-source-update-reconciliation.test.ts tests/unit/stores/skill.store.test.ts`
- `pnpm --dir apps/desktop exec vitest run tests/unit/components/skill-full-detail-async-actions.test.tsx -t "renders source update action state"`
- `pnpm --dir apps/desktop exec vitest run tests/unit/main/skill-installer-remote-git-package.test.ts tests/unit/main/skill-safety-scan.test.ts tests/unit/main/skill-local-repo-ipc.test.ts tests/unit/main/skill-repo-sync.test.ts tests/unit/main/skill-version-ipc.test.ts`
- `pnpm --filter @prompthub/shared typecheck`
- `pnpm --filter @prompthub/db typecheck`
- `pnpm --filter @prompthub/desktop typecheck`
- `pnpm --filter @prompthub/core typecheck`
- `pnpm --filter @prompthub/cli typecheck`
- `pnpm --dir apps/desktop exec vitest run tests/unit/services/skill-source-resolver.test.ts tests/unit/stores/skill.store.test.ts`
- Source diagnostics follow-up regression suite: 12 files / 157 tests passed, including local-linked, managed-copy, remote Git/ZIP/content URL/store diagnostics and UI toast rendering.
- `pnpm verify:release:quick` reached the desktop unit-test stage but reported one unrelated existing failure in `tests/unit/main/rules-workspace.test.ts`: the test expects `grok-global`, while the current platform descriptor set does not include it. The failure reproduces in isolation; source diagnostics checks remain green.
- `pnpm --dir apps/desktop exec vitest run tests/unit/services/skill-source-resolver.test.ts tests/unit/services/skill-store-update.test.ts tests/unit/services/skill-source-update-reconciliation.test.ts tests/unit/stores/skill.store.test.ts tests/unit/main/skill-source-update-db.test.ts tests/unit/main/skill-installer-remote-git-package.test.ts tests/unit/main/skill-safety-scan.test.ts tests/unit/main/skill-local-repo-ipc.test.ts tests/unit/main/skill-repo-sync.test.ts tests/unit/main/skill-version-ipc.test.ts tests/unit/components/skill-full-detail-async-actions.test.tsx tests/unit/components/skill-store-remote.test.tsx`
- `pnpm --dir apps/desktop exec vitest run tests/unit/services/github-skill-store.test.ts tests/unit/main/skill-source-update-db.test.ts tests/unit/services/skill-source-update-reconciliation.test.ts tests/unit/stores/skill.store.test.ts tests/unit/main/skill-installer.test.ts`
- `pnpm --dir apps/desktop exec vitest run tests/unit/stores/skill.store.test.ts tests/unit/components/skill-store-remote.test.tsx tests/unit/main/skill-installer-remote-git-package.test.ts`
- `pnpm --filter @prompthub/db typecheck`
- `pnpm --filter @prompthub/shared typecheck`
- `pnpm --filter @prompthub/desktop typecheck`
- `pnpm --filter @prompthub/core typecheck`
- `pnpm --filter @prompthub/cli typecheck`
- `pnpm --dir apps/cli exec vitest run tests/run.test.ts`
- `git diff --check`
- Static audits with `rg` for direct `directory_fingerprint` / `installed_directory_fingerprint` writes, legacy hash utility use, source update UI labels, and source fetch/clone paths.
- `pnpm verify:release:quick` passed in 329.7s after the repo-copy staging expectation was updated in the legacy installer regression test.
- `pnpm verify:release:quick` passed in 500.2s after the review follow-up fixes for tree/API fingerprints, legacy fingerprint algorithm migration, content-url baselines, and source error URL credential redaction.
- `pnpm --filter @prompthub/desktop typecheck`
- `git diff --check`
- Manual regression probe: `git ls-remote https://clawhub.ai/mineru-extract/mineru-document-extractor HEAD` still fails because the page URL redirects, while ClawHub `SKILL.md` and package zip API endpoints for `mineru-document-extractor` return HTTP 200; the updated source resolver now uses the package zip endpoint for ClawHub updates.

## Remaining Future Work

- A dedicated DB-backed source update service can still centralize renderer orchestration later, but v1 behavior now uses the shared reconciliation builder and persists the required baseline/error fields.
- UI presentation for project/agent downstream stale copy targets can be improved later; v1 intentionally exposes them as auxiliary `SkillSourceUpdateCheck` fields rather than as a source status.

## Review Decisions Applied

- v1 uses `skill-package-sha256-v1` for durable package fingerprints.
- Existing rows with missing `installed_directory_fingerprint` are silently upgraded only when legacy entry hashes prove local and remote match.
- A single `fingerprint_algorithm` field applies to both current and installed package fingerprints.
- `downstream-stale` is removed from `SkillSourceUpdateStatus` and exposed through distribution scan data or auxiliary `SkillSourceUpdateCheck` fields.
- `source-moved` is deferred from v1.
- Remote updates cannot directly overwrite `local-linked` external folders in v1.
- Raw `content-url` sources are treated as single-file packages.
- Safety scan runs after staging materialization and before atomic replace.

## Stable Docs To Sync After Implementation

- `spec/knowledge/behavior/skills.md` synced for v1 source update behavior.
- `spec/knowledge/reference/skill-regression-test-matrix.md` synced for v1 regression coverage.
- `spec/knowledge/structure/skill-system-design.md` synced for resolver and package fingerprint boundaries.
