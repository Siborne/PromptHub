# Official SaaS Workspace Delta Specification

## Added Requirements

### `FR-SAAS-001`: Authenticated Server-Authoritative Workspace

An authenticated SaaS user MUST operate against a server-authoritative
workspace. Browser state, an uploaded backup archive, renderer LocalStorage,
and a client SQLite file MUST NOT be treated as the live SaaS source of truth.

### `FR-SAAS-002`: Tenant-Scoped Normalized Resources

Every live resource MUST belong to a tenant/workspace and be accessed through
tenant-scoped queries. Prompts, folders, versions, relations, output formats,
skills, rules, managed Agent assets, media references, and future collaboration
records MUST use stable resource IDs and explicit revision metadata rather than
requiring a full account snapshot rewrite for each mutation.

### `FR-SAAS-003`: Revision And Conflict Contract

Mutations MUST carry an expected revision or equivalent precondition and an
idempotency key. A stale mutation MUST return a conflict with the current
revision; the service MUST NOT silently apply last-writer-wins to concurrent
interactive edits.

### `FR-SAAS-004`: Version History Is A Domain Feature

Prompt, Skill, Rule, MCP, Plugin, and other domain version history MUST remain
separate from provider disaster-recovery backups and user cloud backup sets.
Editing a resource creates the domain revision required by that domain; it MUST
NOT create adjacent backup files or a full tenant snapshot.

### `FR-SAAS-005`: Media And Large Objects

Media and large package payloads MUST live in object storage under tenant-
scoped keys. The relational store keeps metadata, hashes, ownership, status,
and references. Uploads use bounded size/type validation and staged publication;
deletion respects references, retention, and audit policy.

### `FR-SAAS-006`: Search, Pagination, And Capacity

Lists, histories, audit events, and change feeds MUST use stable cursor
pagination with indexed tenant/resource/revision predicates. The server MUST
not load or rewrite the entire tenant workspace for a single list or mutation.

### `FR-SAAS-007`: Browser And Desktop Share Contracts, Not Storage

The official browser client may reuse PromptHub UI and shared types, but it MUST
call official tenant APIs. It MUST NOT mount a user's local filesystem, share a
desktop SQLite file, or reuse self-hosted physical paths as official SaaS paths.

### `FR-SAAS-008`: Explicit Local Import, Export, And Connection

The first SaaS release MUST provide idempotent import and complete export. A
future connected desktop mode MUST be separately enabled, identify the remote
workspace, persist the last observed remote revision/change cursor, and expose
conflicts and tombstones before changing local authority.

### `FR-SAAS-009`: Self-Hosted Remains A Separate Deployment Mode

Official SaaS and self-hosted Web may share logical contracts and UI, but their
accounts, physical storage, operator trust, URLs, credentials, migrations, and
backup responsibilities remain distinct. No self-hosted deployment is silently
enrolled into the official service.

## Acceptance Scenarios

1. Two tenants using the same resource ID cannot observe or mutate each other's
   records through list, detail, search, media, version, export, or share APIs.
2. Two writes using the same expected revision produce one accepted revision
   and one explicit conflict.
3. Repeating a successful mutation with the same idempotency key does not
   create duplicate versions or usage charges.
4. Updating one Prompt does not deserialize or rewrite unrelated tenant data.
5. A media upload is invisible until object and metadata verification complete;
   a failed publication leaves no readable partial object.
6. Export produces a versioned portable snapshot that can be validated and
   imported into a fresh workspace without sharing the server database.
7. A self-hosted account/session cannot authenticate against official SaaS
   unless the user separately creates or links an official account.

## Verification IDs

- `TEST-SAAS-001`: auth/session/account status and tenant-boundary tests.
- `TEST-SAAS-002`: cross-tenant identifier substitution and policy matrix
  security tests.
- `TEST-SAAS-003`: revision, idempotency, retry, and concurrent mutation tests.
- `TEST-SAAS-004`: domain version history versus backup isolation tests.
- `TEST-SAAS-005`: object staging, reference, quota, and rollback tests.
- `TEST-SAAS-006`: cursor pagination, query-plan, large-tenant, and memory/load
  tests.
- `TEST-SAAS-007`: browser/shared-contract and forbidden local-storage boundary
  tests.
- `TEST-SAAS-008`: import/export, reconnect, tombstone, and conflict tests.
- `TEST-SAAS-009`: official/self-hosted identity and deployment isolation tests.
