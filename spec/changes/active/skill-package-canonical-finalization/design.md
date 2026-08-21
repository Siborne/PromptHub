# Design

## Ownership

- Desktop orchestration: `apps/desktop/src/main/services/skill-package-*`.
- SQLite transaction and Skill versions: `packages/db/src/skill.ts`.
- Canonical Skill publication and workspace projection:
  `packages/core/src/canonical-skill-db.ts` and
  `packages/core/src/canonical-skill-library.ts`.
- Shared result contract remains unchanged.

## Current Source Of Truth

Canonical Skill bundles under `data/skills/<encoded-skill-id>/` are durable
authority once the canonical marker is active. SQLite is the indexed catalog
and version transaction participant. `cache/skill-workspaces/` is disposable.
Managed package replacement paths must not be confused with canonical bundles.

## Analyze Gate

`FR-SKCF-001..003 -> DES-SKCF-001..003 -> TEST-SKCF-001..003 ->
T-SKCF-001..004` is complete enough to begin reproduction. Stable Skill and
storage documents require atomic publication and do not conflict with the
requested repair. No public IPC or schema change is planned.

## DES-SKCF-001 Reproduce The Product Boundary

Use the real Desktop lifecycle dependencies, a real SQLite adapter, and
`CanonicalSkillDB`; mocks are insufficient because they hide file publication
and database adapter interaction.

## DES-SKCF-002 Single Finalization Owner

In canonical mode, the verified staging directory is the publication source.
The lifecycle must not create a legacy managed container under `data/skills`,
because that namespace contains only canonical bundles. `CanonicalSkillDB`
coordinates SQLite finalization, bundle publication, rollback, and hydration of
the disposable `cache/skill-workspaces/<skill-id>` workspace.

Legacy database-authority mode keeps the reversible managed-repository
replacement and recovery manifest. Canonical mode keeps staging under
`operations/skill-package-lifecycle`, relies on the canonical entry publication
journal for bundle rollback, and removes staging after completion or failure.

## DES-SKCF-003 Bounded Work

Package traversal remains linear in file count and bytes, with the existing
4,000-file and 16 MiB per-file limits. The fix must not add extra unbounded
scans, network calls, or concurrency.
