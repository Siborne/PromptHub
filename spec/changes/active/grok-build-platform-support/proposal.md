# Proposal

## Phase And Status

- Phase: implement
- Status: in-progress
- Primary requirement: `FR-GROK-001`
- Exit condition: Grok Build is available as a built-in PromptHub Agent and Skill target with verified rules, configuration, Agent, command, and Plugin discovery paths; MCP and Plugin bundle distribution remain unavailable until they have Grok-specific adapters.

## Why

Grok Build is an extensible coding agent with documented user and project Skill,
Plugin, MCP, and configuration surfaces. PromptHub should expose it as a native
platform target instead of requiring users to create a generic custom agent.

## Scope

- In scope: built-in platform identity, documented default paths, Skill distribution, global rules, Agent/command/Plugin discovery metadata, configuration visibility, safe asset classification, platform visibility, tests, and stable reference documentation.
- Out of scope: installing the Grok CLI, managing xAI authentication or API keys, starting ACP sessions, or writing Grok Build project configuration automatically.

## Risks

- Grok Build is beta and its local contracts may change quickly.
- User and project configuration have different ownership; PromptHub must not write project configuration without an explicit project workflow.
- Grok's TOML MCP schema uses `headers`, while PromptHub's existing Codex TOML adapter writes `http_headers`; treating them as the same target would produce invalid Grok remote MCP configuration.

## Rollback Thinking

- The platform entry is additive. Disabling the built-in platform leaves all Grok-owned files unchanged.

## Related Records

- Stable workflow/knowledge docs: `spec/knowledge/reference/agent-platforms.md`, `spec/knowledge/behavior/skills.md`
