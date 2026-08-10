# Spec Delta: Cloud Collaborative Prompt Sharing

## Added Requirements

### `FR-COLLAB-001`: Workspace membership and roles

The cloud service MUST own workspace membership with at least owner, editor,
and viewer roles. Every Prompt read, list, search, version, media, share, and
mutation operation MUST authorize the authenticated actor against the target
workspace and resource.

### `FR-COLLAB-002`: Explicit Prompt visibility

A cloud Prompt MUST be private, workspace-visible, or public. Public and
token-based shares MUST expose only an allowlisted read model, be revocable,
and never reveal provider keys, local paths, private versions, internal IDs, or
unshared media.

### `FR-COLLAB-003`: Local-first publish and update

Desktop/Web clients MUST treat local SQLite and cloud records as separate
sources joined by explicit provenance. Publish creates or selects a cloud
identity; update requires the last observed remote revision and presents a
conflict when either side changed.

### `NFR-COLLAB-001`: Security and capacity

Authorization MUST be deny-by-default, tenant-scoped in data access, audited
for sensitive changes, rate-limited, paginated, and tested against cross-tenant
identifier substitution. Remote calls MUST have bounded timeout/retry behavior.

## Verification

- `TEST-COLLAB-001`: role matrix for every route/service operation, membership
  removal, owner transfer, last-owner guard, and cross-tenant IDs.
- `TEST-COLLAB-002`: private/workspace/public/token views, revocation, expiry,
  media access, search leakage, caching, and secret/path redaction.
- `TEST-COLLAB-003`: publish, pull, accepted update, stale revision conflict,
  offline edit, deletion, duplicate provenance, retry idempotency, and rollback.
