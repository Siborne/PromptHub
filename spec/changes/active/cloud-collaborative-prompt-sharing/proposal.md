# Cloud Collaborative Prompt Sharing Proposal

## Phase And Status

- Phase: analyze
- Status: design-ready
- Primary requirements: `FR-COLLAB-001`, `FR-COLLAB-002`, `FR-COLLAB-003`
- Related issue: #106
- Exit condition: authenticated users can collaborate through server-owned
  workspaces and explicit Prompt visibility without sharing a SQLite file.

## Why

Multi-user collaboration requires authoritative membership, authorization,
visibility, conflict, and audit semantics. Extending local database access or
public links without that model would expose private content and make updates
ambiguous.

## Scope

- Cloud workspaces, membership, roles, Prompt visibility, and revocable shares.
- Server-side authorization for every read and mutation.
- Explicit desktop local-copy/publish/update flow using stable remote revision.
- Real-time co-editing, comments, billing, organization SSO, and Prompt Store
  publishing are separate future changes.

## Risks And Rollback

- Authorization mistakes can expose private Prompts; deny-by-default policy and
  cross-tenant tests are release blockers.
- Local and remote edits can conflict; updates require revision preconditions
  and never silently overwrite either side.
- Disabling collaboration leaves local Prompt copies intact and revokes remote
  tokens/memberships independently.

## Related Records

- `spec/knowledge/behavior/sync.md`
- `spec/knowledge/behavior/prompt-workspace.md`
- `spec/changes/active/marketplace-expansion/`
