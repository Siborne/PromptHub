# Proposal

## Why

PromptHub has accumulated clear architectural boundaries, but a new AI agent can still miss them because some root instructions are stale and several important constraints live only in scattered docs or chat history. The most visible risk is broad, unscoped implementation: database schema changes, data layout changes, IPC additions, and feature edits can be made without first checking the current boundary record.

## Scope

- In scope:
  - Update `AGENTS.md` so it reflects the current monorepo structure and the real database/runtime storage architecture.
  - Add a mandatory agent operating contract for source-of-truth lookup, feature intake, existing-feature modification, data/storage changes, and verification.
  - Update the project-local `spec-init` skill so it follows the repository's actual `spec/` topology instead of forcing generic `docs/` paths.
  - Add stable rules that make boundary records durable for memoryless AI agents.
- Out of scope:
  - Reworking the full testing standards section.
  - Rewriting all historical specs.
  - Fixing existing implementation bugs unrelated to instruction quality.

## Risks

- Too many rules can be ignored if they are vague. The update should prefer short, mandatory checklists and concrete file paths.
- Overly rigid process can slow small fixes. The update should distinguish trivial local edits from data/API/storage/architecture changes.

## Rollback Thinking

This is documentation and agent-instruction work. Rollback is a simple revert of `AGENTS.md`, the `spec-init` skill changes, and the added stable rule/change records.
