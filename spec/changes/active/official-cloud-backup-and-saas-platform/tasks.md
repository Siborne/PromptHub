# Official Cloud Backup And SaaS Platform Tasks

## Clarify And Governance

- [x] `T-CLD-001` Audit current local storage, self-hosted Web, Cloudflare
      snapshot, desktop Cloud client, and collaboration boundaries.
- [x] `T-CLD-002` Define restore-oriented official backup requirements and
      verification families.
- [x] `T-CLD-003` Define server-authoritative SaaS workspace requirements and
      verification families.
- [x] `T-CLD-004` Confirm `DG-CLD-001` backup/SaaS relationship and
      `DG-CLD-002` backup encryption policy.
- [x] `T-CLD-005` Confirm `DG-CLD-003` initial desktop connection and
      `DG-CLD-004` initial tenancy scope.
- [x] `T-CLD-006` Confirm the `DG-CLD-005` non-destructive lifecycle and retain
      exact retention durations and notification cadence as a pre-launch child
      policy task.
- [x] `T-CLD-007` Record the confirmed target in a storage authority ADR and a
      durable storage-evolution rule. Stable behavior/structure knowledge still
      waits for verified implementation.
- [x] `T-CLD-008` Complete Analyze with no blocking conflict or unresolved
      material decision.

## Implementation Change Split

- [ ] `T-CLD-101` Create an account/tenant/entitlement foundation change with
      schema, API, security, billing-event, and lifecycle tests.
- [ ] `T-CLD-102` Create an official cloud backup provider change with
      manifest/chunk protocol, encryption, retention, restore, historical
      fixture, stress, and failure-injection tests.
- [ ] `T-CLD-103` Create an official personal SaaS workspace change with
      normalized repositories, object storage, browser API adapter, tenant
      isolation, revision, query-plan, and DR tests.
- [ ] `T-CLD-104` Create an explicit backup-to-SaaS import change with staged
      conversion, conflict preview, idempotency, and rollback tests.
- [ ] `T-CLD-105` Create a separate connected desktop/SaaS sync change only
      after tombstones, change cursors, offline retries, and conflict ownership
      are specified.
- [ ] `T-CLD-106` Keep team collaboration implementation in
      `cloud-collaborative-prompt-sharing`, rebased on the approved tenant and
      revision contracts.
- [ ] `T-CLD-107` Before a paid-plan launch, approve exact backup/workspace
      read-only, grace, deletion-pending, notification, export, and exceptional
      retention policies with product, legal, security, and operations owners.

## Implementation Milestones And Gates

- [x] **M0 Local foundation:** canonical domains, renderer migration, staged
      catalog reconstruction, managed safety points, portable consistency, and
      historical/restart/low-disk/failure/browser-clear evidence are complete in
      `database-migration-safety`. File-first runtime authority, production
      domain mutation wiring, on-disk converters, and the 1,000-Prompt bounded
      scale baseline are complete. M1-M6 remain separately scoped and official
      backup restore must use the verified checkpoint/restore contracts.

1. **M0 Local foundation (complete):** canonical resource bundles, renderer-state
   migration, file-first authority, catalog rebuild, managed safety points,
   on-disk converters, and portable snapshot consistency in
   `database-migration-safety`. Historical, restart, low-disk,
   failure-injection, browser-clear, and bounded scale evidence pass.
2. **M1 Control plane:** deliver accounts, tenant-ready personal workspaces,
   devices, entitlements, usage ledger, lifecycle state, audit, and least-
   privilege service identities. Exit requires cross-tenant and webhook replay
   security tests.
3. **M2 Official backup:** deliver E2EE manifest/chunk upload, inventory,
   retention, download, previewed restore, and compatibility converters. Exit
   requires corruption, key-loss, interrupted upload, large-library, and restore
   drill evidence.
4. **M3 Personal SaaS:** deliver normalized live resources, revisions,
   tombstones, cursor pagination, object staging, browser APIs, export, and DR.
   Exit requires tenant-isolation, concurrency, query-plan, load, migration, and
   provider restore evidence.
5. **M4 Explicit import:** convert backup/export content into invisible staging,
   preview stable-ID/name conflicts, and publish idempotently. Exit requires
   failure at every publication boundary with no live partial state.
6. **M5 Connected workspace:** add revisions, change cursors, tombstones,
   offline queue, device revocation, and conflict ownership before changing a
   local workspace to SaaS authority.
7. **M6 Teams:** add memberships, invitations, roles, sharing, seats, and team
   lifecycle through `cloud-collaborative-prompt-sharing` without rewriting
   personal workspace ownership.

Milestones are independently releasable and reversible. M2 and M3 may proceed
after their shared M1 contracts stabilize, but neither may bypass M0 when it
reads, restores, imports, or synchronizes local portable data.

## Verification And Converge

- [ ] `T-CLD-201` Run spec traceability/index checks after decisions and child
      changes are created.
- [ ] `T-CLD-202` Record real production architecture, migrations, RPO/RTO,
      restore drills, and security evidence in `implementation.md` without
      publishing unverified claims.
- [ ] `T-CLD-203` Sync public account/backup/SaaS documentation only for shipped
      capabilities.
- [ ] `T-CLD-204` Complete Converge and archive this umbrella change after every
      approved boundary has an owner or a documented deferred change.
