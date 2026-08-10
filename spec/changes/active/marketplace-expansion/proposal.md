# Marketplace Expansion Proposal

## Phase And Status

- Phase: analyze
- Status: design-ready
- Primary requirements: `FR-MARKET-001`, `FR-MARKET-002`, `FR-MARKET-003`
- Related issues: #132, #177
- Exit condition: Prompt and Skill marketplaces use explicit source adapters,
  preserve provenance, and never depend on undocumented page scraping.

## Why

PromptHub currently has local Prompt and Skill management, but the remaining
marketplace requests cover two different asset types and an external SkillHub
source. A shared source boundary is useful; treating Prompts as Skills or
guessing a third-party download contract is not.

## Scope

- A typed marketplace source contract for catalog, search, detail, package,
  provenance, version, and verification metadata.
- An evidence-gated SkillHub source adapter.
- A Prompt Store read/import experience with an independent Prompt schema.
- Publishing, billing, comments, and marketplace account federation are not in
  the first delivery.

## Risks And Rollback

- External protocols may change; adapters are independently disableable and
  cached responses have bounded TTLs.
- Signature verification proves publisher/package integrity, not behavioral
  safety; PromptHub safety policy remains a separate gate.
- Imported assets remain ordinary local assets and keep source provenance, so
  disabling a source never removes user data.

## Related Records

- `spec/knowledge/behavior/skills.md`
- `spec/knowledge/behavior/prompt-workspace.md`
- `spec/changes/active/skill-store-delivery/`
