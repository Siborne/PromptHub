# Official Cloud Data Lifecycle Delta Specification

## Added Non-Functional Requirements

### `NFR-CLD-001`: Account, Tenant, And Workspace Separation

Authentication identifies an account; authorization is evaluated against a
tenant/workspace membership. Personal workspaces still use tenant-scoped rows
and object keys so adding teams does not require rewriting ownership.

### `NFR-CLD-002`: Entitlements Do Not Own Data

Billing and entitlement state controls feature access, quotas, and plan limits,
but MUST NOT be the source of truth for resource existence or immediate data
deletion. Subscription events are idempotent inputs to an explicit lifecycle
state machine.

### `NFR-CLD-003`: Export, Grace, And Deletion Lifecycle

The service MUST define active, read-only/grace, deletion-pending, and deleted
states. Users retain a documented export path during the grace/deletion-pending
window. Final deletion covers relational records, object versions, derived
indexes, backup sets, sessions, and scheduled jobs, with an auditable completion
record that contains no deleted content.

### `NFR-CLD-004`: Independent Version Axes

The following versions MUST evolve independently and be recorded explicitly:

- local filesystem layout version;
- local SQLite/catalog schema version;
- portable snapshot/backup format version;
- desktop-to-cloud sync protocol version;
- public API version;
- SaaS database migration version;
- object/encryption envelope version.

Compatibility checks MUST compare the correct axes and never infer schema
compatibility from the desktop application version alone.

### `NFR-CLD-005`: Ordered Migrations And Compatibility Window

Server migrations MUST be immutable, ordered, checksummed, observable, and
forward-only with pre-deploy backup/restore evidence. APIs and snapshot readers
must publish a supported client/format window. Unknown newer clients or payloads
fail closed without downgrading metadata.

### `NFR-CLD-006`: Security And Privacy

The service MUST use least-privilege service identities, TLS, encryption at
rest, tenant-scoped data access, secret redaction, bounded signed object URLs,
session rotation/revocation, rate limits, audit events, and input validation.
Logs, analytics, support tooling, and error responses MUST NOT contain secrets
or full private Prompt content by default.

### `NFR-CLD-007`: Disaster Recovery

The official service MUST define and test RPO/RTO targets separately for live
SaaS data and user backup objects. Relational point-in-time recovery, object
versioning/replication, manifest integrity scans, restore drills, and region
failure procedures MUST be verified before claiming production durability.

### `NFR-CLD-008`: Bounded Cost And Abuse Controls

All remote operations use quotas, pagination, timeouts, finite retries with
backoff, bounded queues, per-tenant/object limits, and observable usage ledgers.
Quota calculation and billing meters MUST be reconcilable from durable events
without scanning all tenant content on every request.

### `NFR-CLD-009`: Data Portability And No Lock-In

Users MUST be able to export supported user-owned content in a documented,
versioned format. Account deletion or plan downgrade MUST not require trusting a
proprietary database dump as the only recovery path.

## Approved Lifecycle State Model

The state transitions and non-destructive ordering are approved. Exact
durations and notification cadence are versioned product-policy parameters that
must be approved and published before a paid plan launches:

`active -> over_quota/read_only -> grace -> deletion_pending -> deleted`

- Over quota blocks new storage growth before it blocks reads or export.
- Cancellation does not immediately delete content.
- Account deletion requires explicit confirmation and a scheduled execution
  point, and can be cancelled during the documented pending period.
- Legal/security holds are exceptional server-side states and must not be
  presented as normal user-visible retention.

## Verification IDs

- `TEST-CLD-001`: account/tenant/membership authorization matrix.
- `TEST-CLD-002`: subscription webhook replay, out-of-order events, downgrade,
  and quota enforcement tests.
- `TEST-CLD-003`: export/grace/deletion state-machine and object cleanup tests.
- `TEST-CLD-004`: protocol/version matrix and old/new client fixture tests.
- `TEST-CLD-005`: migration checksum, interruption, rollback/restore, and
  concurrent-deploy tests.
- `TEST-CLD-006`: secret leakage, access control, signed URL, rate-limit, and
  audit tests.
- `TEST-CLD-007`: documented restore drill and corruption-recovery evidence.
- `TEST-CLD-008`: quota, load, cost-ledger, and abuse/stress tests.
- `TEST-CLD-009`: complete export/reimport and deletion portability tests.
