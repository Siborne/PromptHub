# Proposal

## Why

PromptHub has already imported the latest `spec-init` skill and uses its `workflow / knowledge / changes / records` boundaries, but the project rule layer is only partially synchronized with the newer skill templates.

The current project has strong PromptHub-specific rules for testing, traceability, architecture, and documentation sync. It is still missing explicit stable rule entries for:

- bug-fix workflow discipline
- clarification and decision-confirmation behavior
- coding standards as a contributor-facing rule summary
- issue and archive management

Without these rule entries, future agents may read the newer skill and assume those rules exist in the project, while contributors who only read `spec/rules/` cannot find them.

## Scope

In scope:

- Add PromptHub-adapted rule documents under `spec/rules/`.
- Update `spec/rules/README.md` so the rule index matches the newer `spec-init` surface.
- Update `spec/rules/document-routing-rules.md` with explicit rules routing and synchronization behavior.
- Update `AGENTS.md` with a concise pointer to the expanded rule set.
- Record why PromptHub keeps its current active change template shape instead of copying the generic `spec-init` template verbatim.

Out of scope:

- Changing runtime code.
- Changing git hooks or CI enforcement.
- Replacing PromptHub's active change shape with the generic `overview / impact / verification` template.
- Rewriting historical active changes.

## Risks

- Duplicating existing rules could create competing sources of truth. This change mitigates that by making new files route to existing detailed rules instead of restating every requirement.
- Directly copying generic `docs/` paths from the skill would conflict with PromptHub's `spec/` topology. This change rewrites paths to PromptHub's current routing.

## Rollback Thinking

The added and updated docs can be reverted independently. No runtime data, schema, or package contract changes are involved.
