# System Spec Delta

## Modified Requirements

### PromptHub internal docs MUST expose spec-init-compatible entry points

PromptHub MUST expose project-local `spec-init`-compatible entry points for intake, requirements, design, implementation planning, TDD planning, tasks, rules, releases, archive, and ADR documentation.

#### Scenario: contributor needs to place new documentation correctly

- Given a contributor or agent is updating PromptHub internal documentation
- When they inspect the repository documentation entry points
- Then the repository MUST expose `spec-init`-compatible category directories under `spec/`
- And those entry points MUST explain how they map to PromptHub's existing stable truth and change workflow

### PromptHub doc workflow MUST preserve current active change flow

PromptHub MUST keep using `spec/changes/active/<change-key>/` for non-trivial work even after adopting `spec-init` document boundaries.

#### Scenario: non-trivial feature work starts after spec-init integration

- Given a non-trivial feature, refactor, migration, or cross-module bug fix
- When the change is documented
- Then the implementation MUST still create or update a folder under `spec/changes/active/<change-key>/`
- And project-level `spec-init` entry points MUST not be interpreted as a replacement for active change records
