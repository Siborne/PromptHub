# Code Structure Guidelines

This document defines the code organization rules for PromptHub, with a focus on keeping large files maintainable and making feature work easier to extend.

## Goals

- Keep features discoverable: one concern per module.
- Keep UI files readable: move orchestration, helpers, and data transforms out of giant components.
- Keep services composable: separate storage primitives from backup/sync workflows.
- Keep refactors incremental: extract seams first, then move behavior behind those seams.

## Current Hotspots

The enforced source-file limit is 2,000 lines, with 1,500 lines as the preferred
ceiling. The previously baselined files now fit below the preferred ceiling, so
`config/file-line-limit-baseline.json` is empty. Files reported by
`pnpm lint:file-size` at or above the review threshold remain candidates for
further concern-based extraction when touched.

## Practical Thresholds

Use these as review triggers rather than hard failures:

- `> 400` lines: check whether helpers or view sections should move out.
- `> 700` lines: prefer splitting by concern before adding new behavior.
- `> 1000` lines: treat as a structural hotspot; new work should usually extract a module or hook first.

## Split-by-Concern Rules

### Renderer components

Keep the component file focused on:

- state wiring
- event orchestration
- top-level JSX composition

Move these out when they grow:

- pure formatters and transform helpers -> `*-utils.ts`
- reusable stateful logic -> `use-*.ts`
- repeated sections -> sibling presentational components
- API/side-effect workflows -> service or action helpers

Examples:

- `SkillFullDetailPage.tsx` and `SkillDetailView.tsx` now share version-restore helpers through `src/renderer/components/skill/detail-utils.ts`.
- Backup and restore workflows now live in `src/renderer/services/database-backup.ts` instead of being coupled to every IndexedDB helper.
- `CreatePromptModal.tsx` and `EditPromptModal.tsx` now share prompt form utilities and modal behavior through `src/renderer/components/prompt/prompt-modal-utils.ts`, `src/renderer/components/prompt/usePromptMediaManager.ts`, and `src/renderer/components/prompt/usePromptNativeFullscreen.ts`.
- `apps/desktop/src/renderer/components/prompt/EditPromptModal.tsx` delegates editor sections and Markdown preview rendering to sibling modules.
- `apps/desktop/src/renderer/components/prompt/AiTestModal.tsx` delegates provider labels, attachment limits, and shared modal types to `ai-test-modal-config.ts`.

### Renderer services

Separate core storage primitives from orchestration:

- `database.ts`: IndexedDB CRUD and local storage reset primitives
- `database-backup.ts`: export/import/restore workflow
- `webdav.ts`: sync transport and remote merge behavior
- `backup-orchestrator.ts`: backup/sync entry orchestration for UI-facing flows (manual backup, manual sync, auto sync)

When adding new service code, prefer:

1. primitive read/write APIs
2. workflow composition on top
3. UI-facing adapters at the edge

For sync features specifically:

- keep provider transport details in provider services (`webdav.ts`, `self-hosted-sync.ts`, `apps/web/src/services/webdav.server.ts`)
- keep route/page entry logic thin and delegate flow sequencing to orchestrator modules (`backup-orchestrator.ts`, `apps/web/src/services/sync-orchestrator.ts`)

### Main-process services

For large service classes such as `apps/desktop/src/main/services/skill-installer.ts`, split by capability:

- path resolution and validation
- repo read/write operations
- external process integration
- export/import helpers

If a class starts mixing filesystem primitives and workflow orchestration, extract internal helper modules before adding more branches.

## Naming Conventions

- `*-utils.ts`: pure helpers, no UI state
- `use-*.ts`: React hooks
- `*-types.ts`: local type declarations when a module-specific type does not belong in `shared`
- `*-backup.ts`, `*-sync.ts`, `*-installer.ts`: workflow modules with side effects

## Refactor Playbook

When touching a large file:

1. Identify which code is pure, which code is side-effectful, and which code is JSX composition.
2. Extract pure helpers first.
3. Extract shared workflows second.
4. Only then add new feature logic.

This order keeps behavior stable while improving structure.

## Review Checklist

Before merging a structural change, verify:

- the extracted module has a single responsibility
- names communicate intent better than the old inlined code
- callers got simpler, not just shorter
- duplicated logic was removed, not copied
- the new seam is reusable by the next feature

Pair this with the regression checklist in `spec/knowledge/structure/refactor-regression-checklist.md` so extraction work stays behavior-safe.

## Recent Concern-Based Extractions

- Desktop main-process data-path, native-shell, and window-control IPC registration
  now live outside `apps/desktop/src/main/index.ts`.
- AI request transport, Anthropic normalization, and model discovery now live
  outside `apps/desktop/src/renderer/services/ai.ts`.
- MCP health and import workflows now live outside
  `packages/core/src/mcp-library.ts`.
- Dream Skin argument parsing and operation UI now live in sibling injector
  modules.
- CLI Rules bundle import/validation coverage and shared Agent Skills target
  coverage now live in focused test files instead of extending the general
  command suites beyond the 1,000-line default.
- Prompt workspace restore-marker persistence now lives in
  `prompt-workspace-restore-marker.ts`; `prompt-workspace.ts` retains bootstrap
  orchestration and the existing public `writeRestoreMarker` export.
- Prompt and Folder dependency ordering for strict workspace imports now lives
  in `prompt-workspace-import-order.ts`, keeping graph policy separate from
  filesystem and database orchestration.

## Next Refactor Queue

Use the current `pnpm lint:file-size` report rather than a static list. Prioritize
files at or above the review threshold when a related behavior change is made.
