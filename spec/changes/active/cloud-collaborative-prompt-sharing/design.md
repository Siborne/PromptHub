# Cloud Collaborative Prompt Sharing Design

<!-- traceability: enforced -->

## `DES-COLLAB-001`: Server-Owned Authorization Model

Add cloud-owned `workspaces`, `workspace_members`, `cloud_prompts`,
`cloud_prompt_versions`, `cloud_prompt_media`, and `prompt_shares` through the
existing Cloudflare migration boundary. Shared contracts live in
`packages/shared`; authorization and repository operations remain in the
server/Worker layer, not renderer state.

Repository queries include workspace/tenant predicates rather than fetching by
resource ID and checking later. A central policy maps owner/editor/viewer to
operations. Ownership transfer and member removal are transactional; the last
owner cannot be removed without a successor.

## `DES-COLLAB-002`: Visibility And Share Projection

Visibility is an enum with private default. Public pages and share tokens use a
minimal projection containing only approved Prompt content, public author
metadata, declared license/tags, and explicitly shared media. Tokens are stored
hashed, scoped to one resource, optional-expiry, revocable, and rate-limited.
Cache keys include resource revision and visibility state; revocation purges or
invalidates relevant entries.

## `DES-COLLAB-003`: Revisioned Local-Remote Bridge

Local Prompt rows remain canonical for local use. A separate provenance record
stores cloud workspace/Prompt IDs, last observed revision, and sync time. A
publish/update command sends an idempotency key and `If-Match`-style revision.
On conflict, fetch both revisions and present a diff; no automatic last-write
wins. Accepted remote data creates a local Prompt version inside a transaction.

Lists and histories are cursor-paginated with indexed workspace, visibility,
updated-at, and stable-ID keys. Each page is `O(pageSize)` memory; media is
streamed with size/type limits. Calls use timeout, cancellation, bounded retry
for idempotent operations, and clear offline state.

## Analyze Result

- Collaboration is not implemented as direct SQLite/WebDAV sharing.
- Public Prompt Store publishing remains outside this change because it adds
  moderation, licensing, discovery, and publisher lifecycle.

## Traceability

| Requirement      | Design                             | Verification                         | Task           |
| ---------------- | ---------------------------------- | ------------------------------------ | -------------- |
| `FR-COLLAB-001`  | `DES-COLLAB-001`                   | `TEST-COLLAB-001`                    | `T-COLLAB-002` |
| `FR-COLLAB-002`  | `DES-COLLAB-002`                   | `TEST-COLLAB-002`                    | `T-COLLAB-003` |
| `FR-COLLAB-003`  | `DES-COLLAB-003`                   | `TEST-COLLAB-003`                    | `T-COLLAB-004` |
| `NFR-COLLAB-001` | `DES-COLLAB-001`..`DES-COLLAB-003` | `TEST-COLLAB-001`..`TEST-COLLAB-003` | `T-COLLAB-005` |
