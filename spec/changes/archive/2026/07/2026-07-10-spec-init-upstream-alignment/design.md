# Design: Spec-init Upstream Alignment

## DES-SPECINIT-001: Upstream baseline and profile overlay

Synchronize generic embedded assets from upstream commit `f83def1`. Keep
PromptHub-specific behavior in one direct reference,
`.agents/skills/spec-init/references/prompthub-profile.md`, and add only a small
conditional pointer in `SKILL.md`. This reduces future merge drift.

## DES-SPECINIT-002: Phase mapping

Add `workflow_phases` to `spec-init.topology.yml`. Map upstream's `completed`
semantic to PromptHub's authoritative `spec/changes/archive/` path during
convergence, while preserving the existing `changes.completed` compatibility
route.

## DES-SPECINIT-003: Verification document decomposition

Create seven concise files below `spec/workflow/04-verification/`. They are
indexes and stable policy surfaces, not copies of every test command. Existing
strict truth remains in `AGENTS.md`, `spec/rules/testing-standards.md`, active
changes, and domain regression matrices.

## DES-SPECINIT-004: Compatible record IDs

Apply typed IDs to new standalone ADR, issue, bug, and change-request records.
Do not add IDs to existing change directory names or GitHub snapshot files.
Continue the established `archive/YYYY/MM/YYYY-MM-DD-<change-key>` layout.

## DES-SPECINIT-005: Local templates and governance test

Keep PromptHub's five required change artifacts and add a delta-spec template.
Templates must contain explicit traceability and analyze/converge gates. A
shell regression test verifies both generic scaffold output and the PromptHub
profile surface.

## Verification Plan

- `TEST-SPECINIT-001`: Compare embedded generic assets with upstream and
  validate the skill.
- `TEST-SPECINIT-002`: Assert phase keys and analyze/converge rules exist.
- `TEST-SPECINIT-003`: Assert all seven verification documents exist and route
  to stable project truth.
- `TEST-SPECINIT-004`: Assert archive rules preserve historical names and
  require typed IDs only for new standalone records.
- `TEST-SPECINIT-005`: Generate Chinese and English scaffolds and inspect the
  local PromptHub change templates.

## Analyze Result

- The upstream generic scaffold and PromptHub's established change contract
  differ intentionally. The repository profile preserves PromptHub's five
  artifacts and dated archive instead of creating a competing topology.
- The `FR -> DES -> TEST -> T` chain is complete; no requirement, design, or
  verification ID is orphaned.
- No blocking `[待确认]` item remains. Historical renames and ambiguous active
  change lifecycle decisions are explicitly outside this change and tracked by
  `ISS-20260710-001`.
