# Official Cloud Backup And SaaS Platform Proposal

## Phase And Status

- Phase: plan
- Status: target architecture approved; implementation changes pending
- Primary requirements: `FR-CBK-001` through `FR-CBK-008`, `FR-SAAS-001`
  through `FR-SAAS-009`, and `NFR-CLD-001` through `NFR-CLD-009`
- Owners: official cloud service, `packages/shared`, `packages/core`,
  `apps/desktop`, and the browser client reused by the official SaaS product
- Decision date: 2026-08-11
- Exit condition: every approved boundary has an independently deliverable
  implementation change, verified migrations and recovery behavior, and
  converged stable documentation that describes only shipped behavior.

## Why

PromptHub will provide two account-backed products:

1. an official cloud provider that desktop users can select to back up and
   recover local data; and
2. an official SaaS edition where users sign in through a browser and directly
   create, edit, version, search, and organize PromptHub data.

These products may share accounts, entitlements, billing, object storage, and
operational infrastructure, but they do not have the same data semantics. A
backup is an immutable recovery artifact whose source remains the local
workspace. A SaaS workspace is live application state whose source is the
server. Treating one opaque backup payload as the SaaS database would make
authorization, concurrent edits, search, revisions, partial updates, quota
accounting, deletion, and disaster recovery unsafe or unbounded.

## Current Repository Evidence

- `apps/web` is the self-hosted Web product. It uses a deployment-local SQLite
  database and server-owned filesystem workspaces; it is not an official
  multi-tenant SaaS persistence design.
- `apps/web-cloudflare` is currently described as a self-hosted Worker. Its D1
  schema stores one `sync_snapshots.payload_json` row per user, and Web CRUD
  reads and rewrites that snapshot. This is useful compatibility/prototype
  behavior, but it conflates a mutable workspace with a backup snapshot and is
  not the target official SaaS data model.
- `cloud-account-store-client` implements desktop account/Store client
  contracts and explicitly excludes full Prompt/Skill sync, collaboration, and
  payment ownership.
- `cloud-collaborative-prompt-sharing` correctly requires server-owned
  workspaces, memberships, revision preconditions, and tenant-scoped access,
  but it is not implemented.
- `database-migration-safety` defines the target local authority model and
  deliberately excludes new remote transports and collaboration.

## Scope

### In Scope

- Product-mode and source-of-truth matrix for local-only, official backup,
  official SaaS, connected desktop/SaaS, and self-hosted deployments.
- Official backup protocol, immutable manifest/object layout, encryption,
  retention, quota, restore, and historical compatibility requirements.
- SaaS tenant/workspace data model, resource revisions, media storage,
  authorization, audit, export, deletion, and disaster recovery requirements.
- Shared logical resource envelope and independent version axes for local
  layout, backup format, sync protocol, API, and server database schema.
- Paid-account lifecycle, including entitlement loss, over-quota behavior,
  grace/read/export periods, account deletion, and data portability.
- Delivery phases and verification gates before any local authority or remote
  data path is changed.

### Out Of Scope For This Change

- Implementing the official production service or selecting its final hosting
  vendor.
- Replacing self-hosted Web, WebDAV, S3, or Git backup transports.
- Shipping real-time collaboration, comments, organization SSO, public sharing,
  or conflict-free multi-writer sync in the first tranche.
- Moving local data authority before `database-migration-safety` completes its
  file bundle, rebuild, compatibility, and rollback gates.
- Publishing public pricing, retention promises, compliance claims, or release
  notes before the corresponding service exists and is externally verified.

## Product Boundary

| Mode                     | Authoritative user content                                       | Replica/recovery role                        | Browser editing                            |
| ------------------------ | ---------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------ |
| Local only               | Versioned local files; rebuildable local catalog                 | User-managed export only                     | No official remote data                    |
| Local + official backup  | Same local authority                                             | Immutable encrypted cloud recovery snapshots | Backup inventory/restore control only      |
| Official SaaS            | Tenant-scoped server records and object storage                  | Provider DR plus user export                 | Full authenticated CRUD                    |
| Connected desktop + SaaS | Server workspace after explicit connection; local checkout/cache | Offline working replica plus export          | Full authenticated CRUD                    |
| Self-hosted Web          | Self-hosted deployment state                                     | Self-hosted backup policy                    | Full authenticated CRUD on that deployment |

Official backup and official SaaS must not silently share authority merely
because the same account owns both.

## Confirmed Decisions

The following choices were confirmed on 2026-08-11. They define the target
architecture; they do not claim that current production storage already follows
it.

### `DG-CLD-001`: Relationship Between Backup And SaaS

- Option A: keep restore-oriented backup and live SaaS workspace separate;
  offer an explicit, previewed "import backup into SaaS workspace" action.
- Option B: make every official backup immediately become the live SaaS
  workspace.
- **Confirmed:** Option A. Backup and SaaS remain separate products connected
  only by explicit, staged import/export workflows.

### `DG-CLD-002`: Official Backup Encryption

- Option A: client-side end-to-end encryption. The service stores ciphertext
  and cannot provide content browsing; loss of the recovery key has user-data
  consequences.
- Option B: provider-managed envelope encryption with KMS. Account recovery is
  simpler, but the service is technically able to decrypt data under its
  security policy.
- **Confirmed:** Option A for the backup plane. SaaS remains server-readable and
  encrypted at rest because the service must execute authenticated CRUD,
  search, collaboration, and migration behavior. Product copy must label the
  distinction clearly.

### `DG-CLD-003`: First SaaS/Desktop Connection

- Option A: ship the SaaS workspace independently with explicit import/export;
  add connected multi-device sync only after tombstone, revision, and conflict
  policy is complete.
- Option B: make the first SaaS release automatically synchronize the desktop
  personal library.
- **Confirmed:** Option A. The first SaaS release is independent and uses
  explicit import/export. Connected Desktop/SaaS sync is a later workspace mode
  with revisions, cursors, tombstones, offline retry, and conflict handling.

### `DG-CLD-004`: Initial Tenancy

- Option A: personal workspace first, but every row and object key is tenant
  scoped so teams can be added without rewriting ownership.
- Option B: ship personal and team workspaces together.
- **Confirmed:** Option A. The initial product exposes a personal workspace but
  all persistent rows, object keys, authorization, and quotas are tenant-ready.

### `DG-CLD-005`: Retention After Entitlement Loss

- **Confirmed architecture:** entitlement loss or quota exhaustion first blocks
  growth, then follows explicit read-only/grace and deletion-pending states. It
  never immediately deletes the only recoverable snapshot or removes export.
- **Delivery policy parameter:** exact durations, notification cadence, and
  legal/operational exceptions must be approved and published before a paid
  plan launches. These numeric values do not change the storage topology and
  remain a child delivery task rather than an architecture blocker.

### `DG-CLD-006`: Local Durable Data And Secret Scope

- **Confirmed:** local user-created assets, versions, relations, and referenced
  media are recoverable from versioned canonical files under `data/`; local
  SQLite is rebuildable catalog/index plus classified operational state.
- Device login/session credentials remain outside portable user data. Provider
  credentials may enter backup only through a separately enabled encrypted
  vault segment with explicit recovery consequences.

## Risks

- Conflating backup and live workspace authority can cause data loss through
  accidental last-writer-wins behavior.
- A single giant JSON snapshot produces `O(total library)` memory, write
  amplification, and contention for every SaaS edit.
- Weak tenant predicates can expose data across accounts.
- Encryption claims can be misleading if backup ciphertext and live SaaS data
  use different trust models without clear product copy.
- Billing state can accidentally become a destructive data lifecycle trigger.
- Old desktop clients and future schema revisions can corrupt or silently omit
  fields if protocol compatibility is not independently versioned.

## Rollback Thinking

- The official backup provider is additive. Disabling it leaves local data and
  existing self-hosted/WebDAV/S3 transports unchanged.
- SaaS launch must not change local authority. A failed import leaves the SaaS
  workspace unpublished and the source backup/local export unchanged.
- Connected desktop/SaaS sync is a later explicit mode with its own disconnect
  and export path; disconnect never deletes either copy automatically.
- Server schema migrations are forward-only and restorable from provider DR;
  application rollback must support the previous compatible API/protocol
  version without rewriting client data.

## Related Records

- `spec/changes/active/database-migration-safety/`
- `spec/changes/active/cloud-account-store-client/`
- `spec/changes/archive/2026/08/2026-08-18-cloud-collaborative-prompt-sharing/`
- `spec/changes/active/web-sync-contract-completion/`
- `spec/knowledge/behavior/sync.md`
- `spec/knowledge/behavior/web.md`
