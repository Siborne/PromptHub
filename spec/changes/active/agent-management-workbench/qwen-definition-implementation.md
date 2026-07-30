# Qwen Definition Discovery Implementation

## Traceability

- Requirement: `FR-AGENT-029`
- Design: `DES-AGENT-062`
- Verification: `TEST-AGENT-080`
- Delivery task: `T-AGENT-117`

## Delivered Boundary

PromptHub now exposes a Qwen-only Definitions tab for user and project
SubAgents and Commands. Qwen Code remains the source of truth. PromptHub does
not copy definitions into SQLite, backup, sync, Skills, Rules, or Plugins.
Extension-owned child definitions remain excluded so their parent extension is
the only lifecycle owner.

The main process:

- resolves the canonical Qwen user root and project ids
- reads direct `agents/*.md` files and recursive `commands/**/*.md` files
- parses frontmatter with the existing strict YAML core-schema parser
- applies entry, visit, depth, per-file, and cumulative-byte limits
- rejects symlinks, containment escapes, null bytes, and unsafe open requests
- redacts credential-like metadata
- returns renderer-safe metadata without body or absolute filesystem paths
- re-resolves and re-validates a selected file before opening it

The renderer:

- enables Definitions only for Qwen Code
- provides user/project scope and the existing project selector
- separates SubAgents and Commands
- supports bounded search and master-detail selection
- presents loading, empty, partial, invalid, and error states
- uses a dedicated seven-locale namespace without expanding legacy locale files

## Verification

The focused unit, component, IPC, preload, and locale gate passes 31 tests.
Coverage is 100% for statements, branches, functions, and lines across the
Qwen definition scanner, IPC handler, renderer panel, workspace-tab selector,
and locale module.

The production desktop build passes. The focused Electron Agent workspace E2E
passes with real temporary user/project SubAgent and nested Command fixtures.
The E2E also verifies that private definition bodies are absent from rendered
and IPC-visible state.

Shared and desktop typechecks pass. Affected ESLint and scoped
`git diff --check` pass. The repository file-size gate remains red only for the
pre-existing dirty `SkillStore.tsx` and `SkillStoreDetail.tsx`, each at 1,536
lines; no Qwen Definition source or test file exceeds 1,000 lines.

The final desktop regression passes 491 test files and 4,432 tests. Existing
React `act(...)` warnings and expected failure-injection logs remain visible,
but the run has no failed test.

## Resource And Compatibility Notes

Discovery is local and read-only. It starts no watcher, background process,
port, cache, queue, or network request. Each scan is `O(n + b)` plus
deterministic `O(r log r)` result sorting under fixed visit, byte, and result
caps. Missing or malformed individual definitions do not prevent unrelated
entries from appearing.

No CC Switch source, runtime, assets, or subsystem was copied for this slice.
The external MIT checkout remains a workflow and behavior reference only.
