# Official Cloud Backup And SaaS Platform Design

<!-- traceability: enforced -->

## `DES-CLD-001`: Separate Control, Live Data, Backup, And Object Planes

The official service is a modular platform, not one snapshot table:

1. **Control plane:** accounts, sessions, identity links, tenants, memberships,
   entitlements, subscriptions, usage ledgers, devices, and lifecycle jobs.
2. **Live SaaS data plane:** normalized tenant resources, domain revisions,
   tombstones, provenance, idempotency records, and change cursors.
3. **User backup plane:** immutable manifests and encrypted content-addressed or
   backup-scoped objects used only for inventory, download, restore, and
   explicit import jobs.
4. **Large-object plane:** tenant-scoped media/package objects with staged
   publication and relational references.
5. **Derived plane:** search indexes, thumbnails, caches, analytics, and other
   rebuildable projections.

The planes may share deployment infrastructure, but they use separate tables,
object prefixes, IAM permissions, quotas, retention policies, and APIs.

## `DES-CLD-002`: Shared Logical Resource Envelope

Portable resources and connected-client change records use a shared versioned
envelope without requiring local and server physical schemas to match:

```text
resourceId
resourceType
tenantId/workspaceId (remote only)
schemaVersion
revision
updatedAt
deletedAt/tombstone
contentHash
actorId/deviceId
origin/provenance
payload or object references
```

Stable resource IDs survive export/import. Remote tenant IDs are not injected
into local user files unless the user explicitly connects that local workspace.
Provider-private billing, audit, and internal database IDs do not enter portable
content.

## `DES-CLD-003`: Official Backup Protocol

Backup publication is a three-stage protocol:

1. `create upload`: negotiate entitlement, limits, manifest/envelope version,
   chunk/object plan, and expiring upload authorization;
2. `upload objects`: stream bounded chunks/media with hashes and idempotent
   object keys;
3. `complete`: verify required objects, sizes, hashes, encryption metadata, and
   quota, then atomically publish the immutable manifest.

Restore performs list/inspect, compatibility and capacity preflight, streaming
download, hash/authentication verification, local staging, and explicit publish.
Incomplete uploads expire and are reclaimed by a bounded job. Retention deletes
only backup sets proven outside policy; shared/deduplicated objects use reference
accounting before physical deletion.

The current `sync_snapshots.payload_json` shape is not reused for official
backup because it requires full-payload memory and mutable row rewrites.

## `DES-CLD-004`: Server-Authoritative SaaS Workspace

The SaaS store uses normalized relational records for tenant/workspace,
membership, Prompt, Prompt version, Folder, graph records, Rule, Skill metadata,
resource revisions, tombstones, media references, audit events, and idempotency.
Large Skill/package/media bytes stay in object storage.

Every repository method takes tenant/workspace context and includes it in the
query predicate. Stable cursor pagination uses indexed tuples such as
`(tenant_id, updated_at, id)` or `(workspace_id, revision, id)`. Each mutation
updates one bounded resource set in a transaction and emits a change/audit event
through an outbox; it never rewrites an entire tenant snapshot.

The official SaaS browser may reuse the authenticated PromptHub renderer, but
its transport adapter calls official APIs. `apps/web` local SQLite paths and
`apps/web-cloudflare` snapshot persistence are not imported as the production
official storage implementation.

## `DES-CLD-005`: Explicit Backup-To-SaaS Import

The recommended relationship is a conversion job, not implicit shared state:

1. user chooses a backup and target SaaS workspace;
2. service/client obtains the decryption capability required by the approved
   encryption policy;
3. the import worker validates and converts the portable schema into staging;
4. duplicate stable IDs, provenance, and conflicting names/revisions are shown
   in a preview;
5. confirmation publishes the staged resources transactionally or by a
   journaled multi-stage commit when large objects are involved.

Import is resumable and idempotent. Failure deletes or expires staging and
leaves both the backup and active SaaS workspace unchanged.

## `DES-CLD-006`: Desktop Connection Is A Later Sync Protocol

Connected mode requires capabilities that snapshot backup does not provide:

- per-resource remote revisions and expected-revision writes;
- ordered change cursor and bounded pull pages;
- durable tombstones and delete retention;
- local provenance and remote workspace identity;
- explicit conflict states and resolution actions;
- offline queue idempotency, retry, and reconnect behavior;
- device revocation and minimum client/protocol enforcement.

Until those exist, the official desktop provider exposes backup/list/download/
restore and optional explicit SaaS import/export, not automatic bidirectional
sync.

## `DES-CLD-007`: Account, Billing, And Data Lifecycle

Account, subscription, entitlement, usage, and data lifecycle are independent
state machines joined by policy:

- subscription events change entitlements idempotently;
- entitlements determine new-write limits and features;
- usage ledgers record billable/storage events;
- workspace/backup data persists according to retention state, not webhook
  arrival alone;
- downgrade or payment failure first blocks growth, then enters documented
  read/export/grace behavior;
- deletion is a scheduled, auditable job spanning relational, object, index,
  session, and queue state.

The first schema should be tenant-ready even if only one personal workspace is
enabled. Team memberships and seat billing remain owned by
`cloud-collaborative-prompt-sharing`.

## `DES-CLD-008`: Version And Migration Registry

Maintain independent compatibility registries:

| Axis                   | Owner                   | Compatibility behavior                       |
| ---------------------- | ----------------------- | -------------------------------------------- |
| Local layout           | `packages/core`/desktop | one bound layout epoch per process           |
| Local catalog schema   | `packages/db`           | ordered checksummed migrations               |
| Portable backup schema | shared/core             | immutable converters; unknown newer fails    |
| Cloud sync protocol    | shared/cloud            | capability negotiation and support window    |
| Public API             | official cloud          | versioned additive contracts and deprecation |
| SaaS database          | official cloud          | ordered forward migrations and PITR evidence |
| Encryption envelope    | client/cloud            | algorithm/key metadata and rotation path     |

Application version remains diagnostic metadata, not a substitute for these
versions.

## `DES-CLD-009`: Security, Privacy, And Disaster Recovery

- Enforce tenant scope at repository and object-key boundaries; do not rely on
  renderer filtering.
- Use provider KMS/HSM for server-managed keys and documented client key
  derivation/recovery for any E2EE backup mode.
- Separate service identities for control, live data, backup objects, import,
  export, deletion, and support operations.
- Redact secrets/private content from logs, metrics, traces, audit metadata, and
  customer-support views.
- Use relational PITR, object versioning/replication, integrity scans, immutable
  audit/usage records, and scheduled restore drills.
- Publish measured RPO/RTO only after restore evidence exists. Backup durability
  and SaaS availability use separate objectives.

## `DES-CLD-010`: Approved End-To-End Storage Topology

The target has one logical resource model and distinct physical authority per
product mode:

```text
versioned local asset bundles
  -> rebuildable local catalog
  -> optional immutable encrypted official backup

official SaaS client
  -> tenant-scoped live relational records
  -> tenant/workspace-scoped object storage

explicit import/export
  -> staged conversion between portable backup and live SaaS resources

future connected Desktop workspace
  -> SaaS authority plus an identified local checkout and sync cursor
```

The local physical target and future-domain rules are owned by
`database-migration-safety` `DES-DATA-012` and `DES-DATA-013`. In particular,
all PromptHub-owned local assets are recoverable from canonical records below
`data/`; SaaS account, tenant, entitlement, and live workspace records do not
move into that local tree merely because the same account owns them.

Provider-neutral object namespaces preserve the authority boundary:

```text
backups/<region>/<tenant>/<backup-id>/manifest
backups/<region>/<tenant>/<backup-id>/chunks/<content-hash>
backups/<region>/<tenant>/<backup-id>/objects/<content-hash>

saas/<region>/<tenant>/<workspace>/objects/<content-hash>
imports/<region>/<tenant>/<job-id>/...
exports/<region>/<tenant>/<job-id>/...
```

Prefixes, credentials, retention jobs, quotas, and APIs are separate even when
the deployment uses the same physical object-storage provider. The relational
implementation must support transactions, tenant-scoped indexes, ordered
migrations, PITR evidence, and bounded cursor pagination; the design does not
lock PromptHub to one hosting vendor.

## `DES-CLD-011`: Extensible Asset And Protocol Evolution

A new local or SaaS asset family first defines a stable resource type, schema
version, revision behavior, object references, authorization, portability,
retention, and converter support. It then registers a local bundle projector,
SaaS repository, or both according to product ownership. No feature may add a
field only to a giant account snapshot or rely on application version as its
schema version.

Older supported backup/resource schemas use immutable converters. Unknown
newer content is never silently downgraded or rewritten. Connected clients
negotiate protocol capabilities separately from resource schemas, allowing a
new SaaS feature to remain unavailable to an older client without corrupting
the rest of the workspace.

## Capacity And Complexity

- Backup/restore of `E` entries and `B` bytes: `O(E + B)` time, bounded chunk
  memory, bounded queue/concurrency, and `O(B)` remote/object storage.
- SaaS single-resource mutation: expected `O(log N)` indexed lookup plus bounded
  version/outbox writes; never `O(total tenant bytes)`.
- Tenant listing/search: `O(pageSize)` response memory with indexed cursor
  pagination; no unbounded offset or full snapshot parse.
- Import: `O(E + B)` streaming validation and staging, with batched relational
  transactions and capacity reservation before publication.
- Retention/deletion: bounded batches with resumable cursors; no tenant-wide
  synchronous delete inside an interactive request.

## Failure And Rollback

- Backup upload failure: no visible manifest; incomplete objects expire.
- Backup restore failure: active local state stays unchanged or rolls back from
  one managed safety point.
- SaaS mutation failure: relational transaction rolls back; object publication
  remains staged or is compensated by a cleanup job.
- Import failure: staging remains invisible and is resumable/collectable.
- Billing webhook replay/out-of-order delivery: idempotent event store and
  recomputed entitlement; no immediate content deletion.
- Deployment migration failure: stop rollout, preserve prior compatible API,
  restore through tested provider recovery if database rollback is required.
- Region/provider outage: fail explicitly, queue only idempotent work within
  bounds, and avoid pretending stale backup/SaaS data is current.

## Delivery Sequence

1. Record approved decision gates and storage rules/ADR.
2. Complete local portable bundle and migration-safety prerequisites.
3. Build account/tenant/entitlement/usage foundation.
4. Ship official restore-oriented backup provider.
5. Ship independent personal SaaS workspace with import/export.
6. Add explicit backup-to-SaaS import.
7. Design and ship connected desktop/SaaS change protocol.
8. Add team collaboration, sharing, and seat lifecycle.

Each stage is independently reversible and must not claim later-stage semantics.

## Analyze Result

- Requirement links: complete for the planning boundary.
- Verification links: every requirement has an identified contract,
  integration, security, failure, compatibility, or performance test family.
- Blocking conflicts: current Cloudflare snapshot CRUD conflates backup and live
  workspace semantics; stable Web docs describe only self-hosted Web; local
  authority migration is active but incomplete.
- Confirmed decisions: `DG-CLD-001` through `DG-CLD-006` in `proposal.md`.
- Unresolved material architecture decisions: none.
- Delivery policy still required: exact paid-plan retention durations and
  notification cadence before public launch.
- Implementation gate: child implementation changes may be created. Runtime
  changes still depend on local migration prerequisites and each child's TDD,
  security, failure, performance, and release gates.

## Traceability

| Requirement   | Design                                      | Verification                   | Task        |
| ------------- | ------------------------------------------- | ------------------------------ | ----------- |
| `FR-CBK-001`  | `DES-CLD-001`, `DES-CLD-003`, `DES-CLD-010` | `TEST-CBK-001`                 | `T-CLD-102` |
| `FR-CBK-002`  | `DES-CLD-003`                               | `TEST-CBK-001`, `TEST-CBK-002` | `T-CLD-102` |
| `FR-CBK-003`  | `DES-CLD-003`                               | `TEST-CBK-003`                 | `T-CLD-102` |
| `FR-CBK-004`  | `DES-CLD-003`, `DES-CLD-009`                | `TEST-CBK-004`                 | `T-CLD-102` |
| `FR-CBK-005`  | `DES-CLD-003`                               | `TEST-CBK-005`                 | `T-CLD-102` |
| `FR-CBK-006`  | `DES-CLD-003`, `DES-CLD-007`                | `TEST-CBK-006`                 | `T-CLD-102` |
| `FR-CBK-007`  | `DES-CLD-008`, `DES-CLD-011`                | `TEST-CBK-007`                 | `T-CLD-102` |
| `FR-CBK-008`  | `DES-CLD-005`                               | `TEST-CBK-008`                 | `T-CLD-104` |
| `FR-SAAS-001` | `DES-CLD-001`, `DES-CLD-004`, `DES-CLD-010` | `TEST-SAAS-001`                | `T-CLD-103` |
| `FR-SAAS-002` | `DES-CLD-002`, `DES-CLD-004`, `DES-CLD-011` | `TEST-SAAS-002`                | `T-CLD-103` |
| `FR-SAAS-003` | `DES-CLD-004`                               | `TEST-SAAS-003`                | `T-CLD-103` |
| `FR-SAAS-004` | `DES-CLD-004`                               | `TEST-SAAS-004`                | `T-CLD-103` |
| `FR-SAAS-005` | `DES-CLD-004`, `DES-CLD-009`                | `TEST-SAAS-005`                | `T-CLD-103` |
| `FR-SAAS-006` | `DES-CLD-004`                               | `TEST-SAAS-006`                | `T-CLD-103` |
| `FR-SAAS-007` | `DES-CLD-004`                               | `TEST-SAAS-007`                | `T-CLD-103` |
| `FR-SAAS-008` | `DES-CLD-006`                               | `TEST-SAAS-008`                | `T-CLD-105` |
| `FR-SAAS-009` | `DES-CLD-001`, `DES-CLD-004`                | `TEST-SAAS-009`                | `T-CLD-103` |
| `NFR-CLD-001` | `DES-CLD-004`, `DES-CLD-007`                | `TEST-CLD-001`                 | `T-CLD-101` |
| `NFR-CLD-002` | `DES-CLD-007`                               | `TEST-CLD-002`                 | `T-CLD-101` |
| `NFR-CLD-003` | `DES-CLD-007`                               | `TEST-CLD-003`                 | `T-CLD-101` |
| `NFR-CLD-004` | `DES-CLD-008`, `DES-CLD-011`                | `TEST-CLD-004`                 | `T-CLD-007` |
| `NFR-CLD-005` | `DES-CLD-008`, `DES-CLD-011`                | `TEST-CLD-005`                 | `T-CLD-101` |
| `NFR-CLD-006` | `DES-CLD-009`                               | `TEST-CLD-006`                 | `T-CLD-101` |
| `NFR-CLD-007` | `DES-CLD-009`                               | `TEST-CLD-007`                 | `T-CLD-103` |
| `NFR-CLD-008` | `DES-CLD-007`                               | `TEST-CLD-008`                 | `T-CLD-101` |
| `NFR-CLD-009` | `DES-CLD-005`, `DES-CLD-007`                | `TEST-CLD-009`                 | `T-CLD-103` |
