# Verification Evidence

This auxiliary record keeps focused verification batches out of the main
implementation summary. The active traceability source remains `tasks.md`.

## Shared Provider Test Contract Closure

Completed 2026-07-29 for `FR-AGENT-001` to `FR-AGENT-007`,
`DES-AGENT-001` to `DES-AGENT-006`, `TEST-AGENT-002`,
`TEST-AGENT-006`, `TEST-AGENT-012`, and `T-AGENT-011`.

- Audited the completed shared contracts against the real desktop path: fixed
  connection, model and cancellation channels; typed public request/results;
  main-process validation and sender-scoped cancellation; preload forwarding;
  renderer-store consumption; and stable/redacted failure results.
- Added a focused preload regression for all three Provider test operations.
  It verifies that Agent/Profile identity and the cancellable request id are
  forwarded without renderer-side reshaping and that cancellation exposes only
  its request id.
- The combined preload, main IPC and renderer-store gate passes 3 files /
  23 tests. Shared and desktop typechecks and affected desktop ESLint pass.

## Session Fixture, Privacy And Scale Closure

Completed 2026-07-29 for `FR-AGENT-010`, `FR-AGENT-015`,
`DES-AGENT-008`, `DES-AGENT-045` to `DES-AGENT-047`,
`TEST-AGENT-010`, and `TEST-AGENT-011`.

- Re-audited the device-local index and verified live adapters against real
  filesystem/CLI fixtures. The gate covers full and incremental scans, literal
  and Unicode search, lazy detail reads, available native resume commands,
  missing/parse-error rows, malformed and oversized sources, symlink/root
  rejection, and cancellation before scan, during scan, and before commit.
- Reconfirmed that persisted index rows contain redacted metadata only.
  Ordinary WebDAV, S3 and self-hosted sync reuse `exportDatabase`; the portable
  Agent section exports only bounded opt-in source preferences and does not
  serialize session ids, paths, previews, cursors, transcript bodies, runtime
  roots or authentication caches.
- The scale fixture commits exactly 10,000 rows and walks 50 bounded 200-row
  pages. The renderer loads metadata in 50-row pages and mounts transcript
  entries in 80-row increments, keeping DOM and IPC work bounded.
- The focused gate passes 15 files / 94 tests. A renderer-test lifecycle
  cleanup now waits for initial asynchronous effects; its dedicated 5-test
  rerun is clean without React `act(...)` warnings.

## Provider Fixture, Secret And Filesystem Closure

Completed 2026-07-29 for `FR-AGENT-003` to `FR-AGENT-007`,
`NFR-AGENT-001` to `NFR-AGENT-003`, `DES-AGENT-004` to
`DES-AGENT-006`, `TEST-AGENT-004`, `TEST-AGENT-005`,
`TEST-AGENT-007`, `T-AGENT-007`, `T-AGENT-015`, and
`T-AGENT-016`.

- Re-audited the seven full Provider adapters against their native JSON, JSONC,
  TOML and dotenv fixtures. Known and unknown fields, comments, empty installs,
  malformed and oversized input, platform-owned OAuth/ADC state, Unicode and
  redacted import previews are covered.
- Reconfirmed secret isolation from SQLite public JSON and legacy reads,
  renderer IPC, logs, audit snapshots, public export and stable errors.
  Managed credentials remain main-only; native OAuth/auth caches and
  credential-bearing headers are never projected into public state.
- Real temporary files cover encrypted backup, structured write, atomic
  replacement, comment/unknown-field preservation, pre-write digest races,
  partial multi-file writes, semantic re-read verification, exact rollback and
  compensation failures.
- The desktop Provider/security gate passes 27 files / 338 tests and the shared
  core activation/reconciliation gate passes 2 files / 31 tests. The Config +
  Session IPC ownership gate passes 2 files / 13 tests after removing obsolete
  assertions that assigned Session handlers to the Config registrar.

## Model Refresh, Quota And Usage Evidence Closure

Completed 2026-07-29 for `FR-AGENT-015`, `FR-AGENT-023`,
`FR-AGENT-026`, `FR-AGENT-027`, `T-AGENT-028`, and `T-AGENT-030`.

- Provider connection probes perform a bounded live model-list request where
  the verified protocol exposes one. Only model count and requested-model
  availability cross IPC; PromptHub does not persist another model catalog.
- Claude, Codex, Kimi, Antigravity, Gemini and Copilot quota adapters retain
  their main-only credentials, carry a provider evidence label and `fetchedAt`,
  cache for 60 seconds, and support an explicit force refresh. Unsupported or
  custom-provider states do not issue a misleading quota request.
- Verified session sources expose messages and metadata but no trustworthy
  token count or price. PromptHub therefore does not derive usage from message
  count, text length or guessed tokenizer output. The current public usage
  source remains `provider`; proxy-observed evidence stays outside this change.
- The focused service and renderer gate passes 6 files / 155 tests. The two UI
  suites now settle initial asynchronous effects and rerun cleanly without
  React `act(...)` warnings. Desktop typecheck and affected ESLint pass.

## Credential Mutation Integrity

Completed 2026-07-29 for `NFR-AGENT-001`, `DES-AGENT-005`,
`TEST-AGENT-026`, and `T-AGENT-015`.

- A test-first concurrent write reproduced both a shared temporary-file name
  collision and lost-update risk in the encrypted Agent secret file.
- Mutations are now serialized per canonical file path across store instances,
  use collision-resistant same-directory staging names, and preserve invocation
  order for writes and clears. Reads invoked after a mutation wait for that
  mutation, so credential readiness cannot observe stale pre-write state.
- The focused store suite passes 15 tests. The wider Profile credential gate
  passes 6 files / 61 tests, including real SQLite compensation and migration
  coverage. The changed concurrency paths are fully exercised; the legacy
  module-wide coverage report remains 94.22% statements and 93.15% branches.
  Desktop typecheck and affected ESLint pass.
- Extracted the Provider workbench's reusable render/migration mock lifecycle
  into a 231-line test harness. The behavior suite is now 1,297 lines and still
  passes all 24 tests, so new Agent test files stay below the 1,500-line gate
  without weakening or duplicating scenarios.

## OpenCode CLI Update Lifecycle

Completed 2026-07-29 for `FR-AGENT-014`, `DES-AGENT-059`,
`TEST-AGENT-078`, and `T-AGENT-114`.

- Official OpenCode CLI documentation defines `opencode upgrade` and
  `opencode upgrade v<version>`; no other platform was promoted from read-only
  maintenance without an equivalent source-and-rollback contract.
- Tests first proved that a renderer-visible plan could mutate the service's
  stored executable/arguments and that a later registry mutation could erase
  rollback metadata. The service now returns a detached review copy and
  captures immutable update/rollback inputs in main.
- The plan is renderer-bound, expires after five minutes, is capped at 32
  pending entries, and is consumed before the first awaited mutation. Apply
  rechecks executable/version, runs fixed shell-free arguments with timeout and
  output limits, verifies the result, and attempts an exact-version rollback
  on partial failure.
- The focused lifecycle suite passes 19 tests with 100% statement, branch,
  function and line coverage. The broader CLI gate passes 7 files / 61 tests,
  including the seven-locale dialog regression; desktop typecheck, affected
  desktop/shared ESLint, `pnpm spec:test`, Prettier and `git diff --check`
  pass.
- All files changed by this slice remain below 1,500 lines. The repository file
  size gate remains red only for pre-existing, out-of-scope dirty
  `SkillStore.tsx` and `SkillStoreDetail.tsx` at 1,536 lines each; neither file
  was changed by the CLI lifecycle slice.
- No real global OpenCode update was executed; command execution uses the same
  dependency-injected native-command boundary as diagnostics. Install and
  other Agent CLI update workflows remain open under `TEST-AGENT-016` /
  `T-AGENT-029`.

## Codex npm CLI Update Lifecycle

Completed 2026-07-29 for `FR-AGENT-014`, `DES-AGENT-063`,
`TEST-AGENT-081`, and `T-AGENT-118`.

- The canonical registry owns the fixed npm update and exact-version rollback
  arguments. Renderer input is limited to opaque plan ids, and a returned
  review plan cannot mutate the main-owned executable or arguments.
- Only npm and Node version-manager Codex paths are accepted. Homebrew,
  standalone, system, user-local and unknown paths remain diagnostic-only;
  missing npm fails before mutation.
- Apply rechecks the original Codex executable and version, verifies that the
  same executable remains active, and restores the captured
  `@openai/codex@<version>` package if verification fails.
- The regression was red first because a missing Codex executable still
  advertised update capability. The corrected contract reports
  `canUpdate: false` when Codex is absent.
- The focused service gate passes 3 files / 36 tests with 100% statement,
  branch, function and line coverage. The wider Agent CLI/UI/IPC/preload and
  locale gate passes 9 files / 89 tests.
- No real global npm mutation was executed. The remaining aggregate CLI
  lifecycle task still covers other platforms and installation workflows.

## Qwen Code npm CLI Update Lifecycle

Completed 2026-07-29 for `FR-AGENT-014`, `DES-AGENT-065`,
`TEST-AGENT-083`, and `T-AGENT-120`.

- The canonical Qwen registry descriptor owns
  `npm install -g @qwen-code/qwen-code@latest` plus the captured
  `@qwen-code/qwen-code@<version>` recovery command.
- Only npm and Node version-manager paths are actionable. Standalone,
  Homebrew, source, system, user-local and unknown paths stay diagnostic-only;
  missing npm fails before mutation.
- Apply consumes an immutable main-owned plan, rechecks the active executable
  and semantic version, verifies the same executable, and rolls back changed or
  unhealthy post-state without exposing command output or errors.
- The red run failed all seven original cases because Qwen had no update
  descriptor. The completed dedicated suite passes 8 tests; the wider
  lifecycle, diagnostic, IPC, preload, UI, capability and platform gate passes
  11 files / 98 tests. Shared and desktop typechecks and affected desktop
  ESLint pass.
- Shared source has no repository ESLint configuration; attempting desktop
  ESLint on `packages/shared/constants/platforms.ts` is rejected as outside the
  configured base path. Prettier and TypeScript remain the available checks.
- No real npm mutation, installation, network request, commit, push, tag or
  release was performed.

## Agent Workspace Focus And Locale Gate

Completed 2026-07-29 for `DES-AGENT-060`, `TEST-AGENT-017`, and
`T-AGENT-115`.

- The regression was written first and reproduced the user-visible keyboard
  trap: selection returned from Sessions to Overview when the next Agent did
  not support sessions, but focus remained on the now-disabled Sessions tab.
- The shared tab shell now moves focus to the selected tab only when focus was
  already inside that tab list. Existing tests cover the non-stealing path and
  the new regression covers the recovery path.
- The aggregate UI gate passes 8 files / 106 tests across the shared workspace,
  overview, assets, sessions, diagnostics, Provider workbench and locale
  parity. The post-format focused gate passes 3 files / 32 tests.
- The focused Electron workspace E2E initially exposed a stale test contract:
  direct locators cannot materialize offscreen rows after the Agent list became
  virtualized. The test now selects Agents through the production search flow
  and passes end to end for the 31-entry registry plus Claude, Codex, Kimi,
  Qwen and OpenCode Provider/config/session/secret boundaries.
- The seven locale files have the exact English `agents` leaf-key set, every
  leaf is a non-empty string, and no unresolved `agents.*` value is accepted.
- Focused `AgentsWorkspace.tsx` coverage is 98.17% statements/lines, 93.97%
  branches and 90.9% functions; uncovered lines 310 and 374-379 are existing
  defensive branches. Both outcomes of the changed focus guard are exercised.
- Desktop typecheck and affected ESLint pass. The repository file-size gate
  remains red only for the unrelated dirty `SkillStore.tsx` and
  `SkillStoreDetail.tsx` at 1,536 lines each.
- The desktop production build passes, followed by
  `playwright test tests/e2e/agent-workspace.spec.ts` at 1 test / 10.1 seconds.
  The build retains existing chunk-size and mixed static/dynamic import
  warnings; Playwright reports only Node deprecation/color warnings.

## Full Desktop Regression Gate

Completed 2026-07-29 as current evidence for `TEST-AGENT-018`.

- The first complete run exposed two stale test contracts rather than
  production failures: Copilot Plugin discovery still expected `plugins`
  instead of the documented read-only `installed-plugins/` inventory, and the
  local Skill integration omitted the explicit disabled safety-scan policy.
- The assertions now match the existing product boundaries without promoting
  Copilot Plugin distribution or remote scanning for local filesystem sources.
  The focused cross-domain gate passes 6 files / 132 tests.
- Desktop typecheck and affected ESLint pass. The repeated full desktop suite
  passes 482 files / 4,380 tests. Expected failure-injection logs, existing
  React `act(...)` warnings, and the Vite CJS deprecation warning remain
  non-failing test debt.

## Provider Profile Deep-Link Import

Completed 2026-07-29 for `FR-AGENT-016`, `DES-AGENT-061`,
`TEST-AGENT-015`, `TEST-AGENT-079`, `T-AGENT-031`, and `T-AGENT-116`.

- The shared parser accepts only
  `prompthub://import?payload=<percent-encoded-json>` with envelope version 1,
  one `provider-profile` object, bounded depth/count/size, a registered
  evidence-backed platform, an allowed protocol and public configuration.
  Unknown keys, duplicate query values, unsupported domains and literal
  credential fields fail closed without returning the launch URL.
- Main owns protocol registration, initial/second-instance routing and a
  ten-command FIFO. Packaged and development registration use explicit
  executables and arguments; E2E mode does not mutate the operating-system
  protocol registry.
- Renderer preview exposes the complete public Profile and model mappings.
  Cancel writes nothing. Confirm is single-flight, delegates to the existing
  Provider Profile service, selects the created Profile and does not activate
  or project native config.
- Shared tests pass 21 tests; `agent-deep-link.ts` measures 100% line, branch
  and function coverage. Desktop deep-link routing, dialog and bridge pass 27
  tests with 100% statement, branch, function and line coverage. The final
  startup extraction adds three routing cases, bringing that gate to 30 tests
  and the locale-parity run to 5 files / 38 tests.
- Shared and desktop typechecks and affected desktop ESLint pass. No real
  protocol registration, Profile import, native activation or credential
  mutation was performed during verification.
- The desktop production build passes. Existing renderer chunk-size and
  `fflate` mixed-import warnings remain non-failing build debt.

## Provider Credential Editor

Completed 2026-07-29 for `FR-AGENT-024`, `DES-AGENT-020`,
`TEST-AGENT-027`, and `T-AGENT-048`.

- The red test first proved that edit mode lacked explicit keep, replace and
  remove actions. The form now requires an explicit replacement choice,
  rejects an empty replacement before IPC, and can reveal only the new
  renderer draft. Existing secure-store material is never returned.
- The focused UI and locale gate passes 5 files / 35 tests. The wider
  Profile credential gate passes 10 files / 91 tests, including real SQLite
  migration, compensation and secure-store serialization coverage.
- `AgentProviderCredentialField.tsx` has 100% statement, branch, function and
  line coverage. The containing legacy form is 94.64% statements/lines,
  94.35% branches and 95.45% functions; every changed credential branch is
  exercised.
- Desktop typecheck, affected ESLint and Prettier pass. The file-size gate
  remains red only for unrelated dirty `SkillStore.tsx` and
  `SkillStoreDetail.tsx` at 1,536 lines each.

## Cline Native History

Completed 2026-07-31 for `FR-AGENT-064`, `DES-AGENT-079`,
`TEST-AGENT-097`, and `T-AGENT-134`.

- The red test first proved that the Cline branch was unsupported. The focused
  adapter suite now covers absolute `CLINE_DATA_DIR`, native
  `sessions.db`/snapshot reads, visible-turn search, legacy task fallback,
  malformed records, missing roots, symlink rejection, and in-root external
  message artifacts (5 tests).
- The index-service, index-root, managed-agent capability, and renderer search
  regressions pass in the focused gate (59 tests across 5 files). Cline is
  declared `partial` and carries `cline --id <session-id>` without starting a
  native process.
- Desktop, core, and shared typechecks, affected desktop ESLint, Prettier and
  `git diff --check` pass. The Cline adapter is read-only and no native Cline
  files, hub, credentials, index rows or transcript copies are created.
- A standalone coverage probe reports 95.35% line and 70.3% branch coverage
  for the new adapter; the remaining uncovered branches are defensive
  malformed-index/oversized-body fallbacks and remain a pre-release hardening
  item rather than a claim of full module coverage.

## Cursor Native History

Completed 2026-07-31 for `FR-AGENT-065`, `DES-AGENT-080`,
`TEST-AGENT-098`, and `T-AGENT-135`.

- The red test first proved that the Cursor branch was unsupported. The
  focused adapter suite now covers local project transcript discovery, search
  through visible turns, user/assistant projection, 2 MiB truncation,
  malformed input, symlink rejection, missing roots, and native resume metadata
  (5 tests).
- The focused Cursor/service/index/renderer/managed-agent gate passes 73 tests
  across 6 files. Cursor is declared `partial`; the adapter reads only local
  `agent-transcripts` JSONL and never starts Cursor, opens its private history
  database, or mutates native state. The standalone adapter coverage probe is
  100% statements, branches, functions, and lines.
- Desktop and shared typechecks, affected desktop ESLint, and `git diff
  --check` pass. Full desktop/e2e and release harness runs remain pending for
  the broader active change.
