# Design

## DES-PMB-001 Inventory Classes And Ownership

- **Process composition:** Electron main entry, renderer `MainContent`, Sidebar.
- **Domain services:** Plugin library, MCP library, AI service, installer facade.
- **State composition:** settings store, Skill store.
- **Product surfaces:** Plugin, Skill, MCP, Settings, and detail components.
- **Tests:** monolithic component/store/main suites with shared mutable setup.

## DES-PMB-002 Extraction Rules

1. Pure parsing, normalization, policy, and identity move before side-effect orchestration.
2. Filesystem/network/DB adapters keep explicit inputs and errors; UI and stores do not absorb them.
3. Zustand roots compose typed domain slices; slices do not import the store singleton.
4. Page roots compose sections and controllers; durable policy remains in services/core.
5. Test files mirror the production public boundary and own isolated setup.

## DES-PMB-003 Conflict-Aware Scheduling

### Stage 1: Guardrail And Low-Risk Edges

- Add the line-count gate and baseline.
- Reduce files just above 2,000 through existing natural boundaries.
- Split an oversized test where independent public route behavior already exists.

### Stage 2: Skill And Settings Composition

- Continue `skill-module-boundary-refactor` for Skill store/detail/tests.
- Convert settings into domain slices with centralized persistence migration.

### Stage 3: Plugin Domain

- Coordinate with `plugin-management`.
- Split core Plugin library into package validation, marketplace/source resolution, persistence/versioning, distribution adapters, and service orchestration.
- Split PluginManager into library/store/agent/detail controllers and views.

### Stage 4: Shell, MCP, AI, And Remaining Tests

- Extract renderer shell routing and navigation derivation.
- Split MCP/AI by provider/protocol and orchestration boundaries.
- Remove legacy baseline entries as each module converges below 2,000 lines.

## DES-PMB-004 Verification Strategy

Each stage runs the lowest effective unit/contract suite, typecheck, focused lint, production build when renderer/main bundling changes, and `pnpm lint:file-size`.

- `TEST-PMB-001`: the line gate rejects every file above 2,000 lines, every new file above 1,500 lines, and growth of each ratcheted legacy file.
- `TEST-PMB-002`: focused domain suites exercise the extracted Plugin, Skill, settings, shell, MCP, main IPC, and AI boundaries.
- `TEST-PMB-003`: typecheck and production build preserve public imports, renderer composition, IPC/preload contracts, and persisted-store compatibility.
- `TEST-PMB-004`: split test suites keep behavior assertions in domain-owned suites with isolated fixture/setup modules.
- `TEST-PMB-005`: `git diff --check`, release verification, and the active-change inventory confirm coordinated work has no formatting or release regression.

## DES-PMB-005 Function Boundary Treatment

New policy, I/O, state-transition, and action functions created by this change stay at or below 50 lines. Rendering composition roots may exceed that preferred limit only when they route independently owned UI regions without owning durable policy, persistence, IPC, or filesystem work. Each retained composition root is recorded in the implementation record with its focused regression suite; future behavior changes to one require extracting the affected region first rather than extending the root.
