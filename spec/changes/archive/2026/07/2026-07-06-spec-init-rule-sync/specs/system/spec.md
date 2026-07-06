# System Spec

## Requirements

### Requirement FR-001: Sync Missing Rule Categories

PromptHub MUST expose project-adapted entries for the missing `spec-init` rule categories that are already relevant to this repository.

#### Scenario: Contributor looks for bug-fix rules

- Given a contributor starts from `spec/rules/README.md`
- When they need bug-fix discipline, clarification rules, coding standards, or issue management
- Then the index links to PromptHub-owned rule files under `spec/rules/`

### Requirement FR-002: Preserve PromptHub Routing

PromptHub MUST adapt generic `spec-init` paths to the existing `spec/*` topology instead of introducing duplicate internal `docs/*` truth sources.

#### Scenario: Agent syncs rules from spec-init

- Given a generic rule template references `docs/rules/*` or `docs/issues/*`
- When it is applied to PromptHub
- Then the route is rewritten to the corresponding `spec/rules/*`, `spec/issues/*`, `spec/knowledge/*`, or `spec/workflow/*` path

### Requirement FR-003: Avoid Historical Backfill Noise

This change MUST NOT mass-rewrite historical active changes, add synthetic numbered requirements to old changes, or rename folders without an explicit separate naming plan.

#### Scenario: Rule sync finds older active changes without new numbering

- Given an older active change does not follow the latest numbering style
- When this rule sync is applied
- Then the older change remains untouched unless it is directly in scope for a later folder or numbering cleanup

### Requirement FR-004: Define Folder Naming And Numbering Rules

PromptHub MUST distinguish ordered workflow folders, semantic change keys, archive date prefixes, and in-file traceability IDs.

#### Scenario: Contributor creates a new active change

- Given a contributor needs a new change folder
- When they read the change docs
- Then they can tell that active changes use semantic kebab-case keys, issue changes include the issue number in the key, archived changes use date prefixes, and `FR / DES / TEST / T` IDs stay inside markdown content

### Requirement FR-005: Keep Active Changes Current

PromptHub MUST keep `spec/changes/active/` limited to changes that are still being worked, blocked, under review, or currently dirty in the working tree.

#### Scenario: Historical change is completed

- Given an active change has all tasks checked and implementation records completion or verification
- When it is no longer dirty in the current working tree
- Then it is moved to `spec/changes/archive/<YYYY>/<MM>/<YYYY-MM-DD>-<change-key>/` and exact path references are updated

#### Scenario: Historical change still needs attention

- Given an active change has unchecked tasks, explicit in-progress markers, review ambiguity, or current working tree modifications
- When the archive cleanup runs
- Then the change remains in `spec/changes/active/` for later implementation or manual review

### Requirement FR-006: Group Archive By Year And Month

PromptHub MUST keep archived change folders under year/month directories instead of flat date-prefixed folders at the archive root.

#### Scenario: Contributor browses archived changes

- Given multiple completed changes exist across months
- When the contributor opens `spec/changes/archive/`
- Then the root contains year directories, each year contains month directories, and each month contains `YYYY-MM-DD-<change-key>` folders

## Traceability

- `FR-001` -> `DES-001`, `DES-002`, `DES-003` -> `TEST-001`, `TEST-003` -> `T-001`, `T-002`, `T-003`
- `FR-002` -> `DES-001`, `DES-002`, `DES-003` -> `TEST-001`, `TEST-002` -> `T-001`, `T-003`, `T-004`
- `FR-003` -> `DES-004` -> `TEST-002`, `TEST-003` -> `T-004`, `T-005`
- `FR-004` -> `DES-005`, `DES-006` -> `TEST-004`, `TEST-005` -> `T-006`, `T-007`
- `FR-005` -> `DES-007` -> `TEST-006` -> `T-008`
- `FR-006` -> `DES-008` -> `TEST-007` -> `T-009`
