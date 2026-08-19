# Official Cloud Backup And SaaS Platform Implementation

## Status

- Phase: M0 implemented; M1-M6 child changes pending
- Status: local file-first canonical/portable foundation verified; cloud control plane not implemented
- Production code changed: local storage foundation only

## M0 Local Foundation

- All current local durable domains have versioned canonical bundles and a
  production mutation path plus checkpoint projector backed by a consistent
  SQLite image.
- Renderer durable settings, sources, identities, recovery metadata, Prompt
  variable cache, and credentials have canonical main-process owners and
  browser-clear coverage.
- SQLite reconstructs from canonical files with Prompt graph/resource hashes,
  current migration markers, classified same-device table preservation,
  `quick_check`, and read-only reopen verification.
- Full portable exports hold one maintenance intent, stream the archive, and
  require semantic agreement between the logical envelope and canonical tree.
  Selective exports cannot leak the full checkpoint.
- Managed safety points, staged root operations, journaled restore, recovery
  registry, diagnostics, historical tag fixtures, low-disk refusal, and failure
  recovery are implemented and verified.
- Desktop startup publishes file-first authority after renderer migration,
  protects the former tree as one bounded checkpoint, and keeps the old context
  on failure. Immutable resource converter chains preserve additive fields and
  revision while refusing downgrade; a 1,000-Prompt scale fixture verifies
  bounded first publication and incremental reuse.
- This milestone is the transport/restore foundation only. It does not add an
  account, tenant, entitlement, official backup service, billing, or SaaS data
  plane, and it does not turn the existing self-hosted snapshot payload into an
  official cloud model.

## Completed Planning Work

- Audited the current self-hosted Web, Cloudflare snapshot, desktop Cloud
  client, collaboration, sync, and local migration-safety boundaries.
- Separated official restore-oriented backup from live server-authoritative
  SaaS workspace semantics.
- Defined requirements for account/tenant ownership, immutable backups,
  normalized SaaS resources, revisions, media, billing/entitlements, retention,
  deletion, export, independent version axes, security, capacity, and disaster
  recovery.
- Recorded the current `sync_snapshots.payload_json` + mutable Web CRUD design
  as a prototype/compatibility boundary that must not become the official SaaS
  production storage model.
- Confirmed separate local, official-backup, official-SaaS, connected-workspace,
  and self-hosted authority modes.
- Confirmed client-side encrypted immutable backup, server-readable SaaS data
  encrypted at rest, tenant-ready personal workspace first, and explicit
  backup-to-SaaS import.
- Added an accepted storage authority ADR and a mandatory storage-evolution rule
  covering future asset domains, independent version axes, migration,
  rollback, backup semantics, cloud boundaries, and verification.
- Added an ordered M0 through M6 implementation plan with independent release
  and rollback gates.

## Verification

- M0 evidence: Core 248 tests, Desktop main storage 182 tests, Desktop
  renderer/integration storage 49 tests, CLI shared-root 55 tests, and
  self-hosted Web topology 35 tests passed with the current implementation.
- Core, DB, and Desktop TypeScript checks passed. Historical canonical rebuild
  covers `v0.4.7`, `v0.4.8`, `v0.5.1`, and `v0.5.2`.
- `pnpm spec:index`: passed; the active change inventory was refreshed.
- `pnpm spec:test`: passed, including governance, single-source, inventory, and
  traceability validation for 23 change records.
- Prettier validation for every touched authored Markdown document: passed.
- `git diff --check`: passed.
- No M1-M6 production tests are claimed; those services remain unimplemented.

## Analyze

- Traceability complete for the planning requirements: yes.
- Blocking material architecture decisions: none.
- Exact paid-plan retention durations and notification cadence remain a
  pre-launch product/legal/operations task, not a storage-topology decision.
- Production changes must be delivered through the child changes in
  `tasks.md`; this umbrella change does not authorize a cross-cutting rewrite.

## Converge

- The approved target is recorded in an ADR and project rule. Stable
  workflow/knowledge behavior is intentionally not rewritten as shipped truth
  until production behavior and migration evidence converge.
- Public docs and release notes are intentionally unchanged.
- Final destination: dated archive after decisions, child implementation
  changes, verification evidence, and stable docs agree.

## Follow-Ups

- Create and execute the independently deliverable M1 through M6 child changes.
- Approve exact paid-plan retention and notification parameters before launch.
- Converge stable storage, recovery, sync, cloud, and operations knowledge only
  after implementation evidence matches the accepted target.

## Lifecycle Disposition (2026-08-18)

Status: approved architecture record, not an executable active change. The
file-first foundation already delivered is preserved here; the unimplemented
cloud control-plane phases are roadmap scope and must be opened as bounded child
changes when scheduled. This umbrella no longer occupies the active WIP queue.
