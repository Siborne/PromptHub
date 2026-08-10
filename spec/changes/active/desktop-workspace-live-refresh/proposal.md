# Desktop Workspace Live Refresh Proposal

## Phase And Status

- Phase: analyze
- Status: design-ready
- Primary requirement: `FR-REFRESH-001`
- Related issues: #198; #199 is a duplicate subset
- Exit condition: externally committed PromptHub data is visible without an
  application restart, with drafts, selection, and resource use protected.

## Why

Desktop stores load durable SQLite and filesystem data into renderer state. A
successful CLI or external adapter write therefore remains invisible until the
renderer reloads. Restarting the application is an unsafe substitute for an
explicit consistency workflow.

## Scope

- One shared refresh coordinator for Prompt, Skill, Rules, MCP, Plugin, Agent,
  and derived counts.
- Manual refresh from primary workspaces and a bounded focus-resume stale check.
- Draft conflict protection, stable selection, loading feedback, and errors.
- No background polling or unbounded filesystem watcher.

## Risks And Rollback

- Refreshing every store independently can create mixed generations. The
  coordinator publishes one generation only after required reads settle.
- A refresh must never overwrite an unsaved editor draft. Failed domains retain
  their previous readable state and report partial failure.
- Removing the coordinator restores current per-store reload behavior without
  changing durable data.

## Related Records

- `spec/knowledge/behavior/desktop.md`
- `spec/knowledge/behavior/prompt-workspace.md`
- `spec/knowledge/behavior/rules-workspace.md`
