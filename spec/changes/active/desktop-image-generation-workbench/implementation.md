# Desktop Image Generation Workbench Implementation

## Status

- Phase: implement
- Status: in-progress
- Production implementation: first Desktop vertical slice implemented; broader
  performance, backup/recovery, sync exclusion, and release-harness work remains.

## Current-State Findings

- Navigation clarification: the workbench belongs to Prompts secondary navigation,
  peer to relationship graph, rather than the global left rail.
- Product defaults recorded: generated assets outlive their source Prompt, a batch is
  capped at 100 outputs, and one batch uses one model.
- Data-layout review corrected the draft boundary: generation manifests and originals
  live under `data/` as filesystem truth; SQLite remains a rebuildable index.
- Sync decision recorded: generation records and originals remain device-local and are
  excluded from every remote payload in the first release.
- Desktop 已有 image Prompt、参考图、image-generation route 和多个图片模型 adapter。
- Prompt AI 测试当前以单张结果为主，测试抽屉持有临时生成状态。
- 生成图片可以下载或添加回 Prompt，但没有独立的持久批次、attempt、output 和
  provenance 数据边界。
- Prompt gallery 展示 Prompt 的首张媒体，不能替代批量作品工作台。
- 图片文件已经通过 runtime path 和 main-process IPC 落到本地 assets，新增设计必须
  复用该安全边界，不能让 renderer 直接操作任意路径。

## Shipped

- Accepted UI concept stored at `assets/workbench-ui-concept.png`; it confirms the
  Prompts secondary-navigation placement and canvas-first workbench hierarchy.
- Added the Prompts secondary-navigation entry and a dedicated Desktop image
  generation workbench.
- Added compact generation controls, resolved Prompt variables and references,
  result filters, sortable density modes, multi-selection, output actions, a fixed
  batch queue, progress, and provenance detail.
- Added local generation contracts, runtime paths, manifest-backed storage,
  SQLite indexing, IPC/preload exposure, runner orchestration, retry/cancel/favorite,
  recovery, and explicit copy-to-Prompt-media behavior.
- Generation originals and manifests remain under the local generation library;
  adding an output to a Prompt copies it into the existing Prompt media boundary.
- Review hardening moved originals to `data/generations/assets/`, preserves legacy
  Prompt-media selection when the obsolete generated subdirectory exists, and migrates
  legacy workbench outputs on read without moving them into Prompt media.
- Remote URL results now pass through the main-process SSRF/size boundary and commit
  directly to the generation library. PNG, JPEG and WebP are detected from bytes rather
  than being recorded as a hard-coded PNG.
- Reference images are preflighted and forwarded only for supported Gemini image
  adapters. Unsupported model/reference combinations are blocked before batch creation;
  provider-specific aspect ratios are normalized before request execution.
- Per-batch mutations are serialized. Cancelling also terminalizes the running slot,
  rejects late provider output, and metadata-only favorite changes preserve the original
  completion timestamp.

## Verification

- Documentation checks:
  - `pnpm spec:index`: passed; regenerated `spec/changes/index.md`.
  - `pnpm spec:index:check`: passed.
  - `pnpm spec:test`: passed all commit-rule, governance, inventory and
    single-source checks.
  - Prettier write/check for all nine change Markdown documents: passed.
  - `git diff --check`: passed.
  - ID audit: all 15 `FR-IGW-*` requirements and `NFR-IGW-SYNC-001` appear in
    their delta specs and the `FR/NFR -> DES -> TEST -> T` traceability table.
  - Warning: a direct Prettier check of generated `spec/changes/index.md`
    reports generator-format differences. The generated file was not manually
    reformatted because `spec:index:check` is its canonical validation.
- Runtime tests:
  - Core generation policy: 13 tests passed.
  - Desktop generation library: 16 tests passed.
  - Desktop generation runner: 6 tests passed.
  - Desktop workbench component: 6 tests passed.
  - Runtime paths, local media protocol, remote image policy, media URL, and AI transport:
    46 focused tests passed.
  - Combined focused Desktop verification: 74 tests passed across 8 files.
  - Desktop sidebar regression: 19 tests passed.
  - Desktop TypeScript check: passed.
  - Focused ESLint for the workbench, queue, and component tests: passed.
  - Focused coverage run: 32 tests passed; generation library reached 100% functions,
    94.72% lines and 84.89% branches; remote download reached 100% functions/lines and
    93.75% branches; runner remains 72.5% lines and 58.46% branches. The open
    coverage gap remains recorded under `T-IGW-009`/`T-IGW-013`; no full-coverage claim
    is made.
  - Desktop production build: passed after the latest gallery interaction follow-up;
    existing chunk-size warnings remain.
- Visual QA:
  - Reference review completed against `assets/workbench-ui-concept.png`.
  - Revised Electron implementation captured at the reference `1596x986` viewport.
  - Empty-state hierarchy passed visual review; runtime measurements found no document,
    configuration-row, or gallery-toolbar horizontal overflow. Populated-state capture
    remains pending before convergence.

## Analyze

- Traceability drafted: yes.
- Analyze gate passed: yes for requirements/design/test/task alignment.
- Blocking product decisions: none.
- Confirmed decisions:
  - Prompts secondary-navigation placement;
  - output lifetime after Prompt deletion;
  - 100-output batch maximum;
  - one model per batch in the first release.
  - generation records and originals are local-only in the first release.
- Navigation reference:
  - `spec/changes/active/app-shell-left-rail/` remains unchanged because no global item
    is added.
- Sync reference:
  - `spec/changes/active/web-sync-contract-completion/` continues its existing supported
    payload contract and excludes this feature's local-only directories.
- Detailed plan artifacts:
  - `data-contract.md`
  - `orchestration.md`
  - `ui-acceptance.md`
- Production implementation: partial; first-slice tests preceded the main storage,
  runner, navigation, and renderer behavior. Remaining test methods stay open in
  `tasks.md`.

## Converge

- Stable workflow/knowledge/rules synced: no; active delta is not implemented.
- Issues/releases/ADRs/indexes synced: pending.
- Final change destination: remain active until implementation and convergence.

## Synced Docs

- None yet. Stable documents remain the description of currently shipped behavior.

## Follow-Ups

- Add a deterministic populated-generation fixture and capture gallery, selection, and
  failure states at the accepted concept viewport.
- Complete stress, backup/recovery, remote-payload exclusion, coverage, and release
  harness verification before convergence.
