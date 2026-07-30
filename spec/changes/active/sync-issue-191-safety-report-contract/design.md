# Design

<!-- traceability: enforced -->

## Current Boundary And Root Cause

The canonical runtime type is
`packages/shared/types/skill.ts::SkillSafetyReport`, whose scan method is
`ai | preflight`. Desktop preflight scanners emit `preflight`, and Desktop
self-hosted export forwards the report. The receiving Web schema in
`apps/web/src/services/sync-snapshot.ts` instead accepts `ai | static` and
transforms both to `ai`.

The existing Desktop backup import helper in
`database-backup-format.ts` also forces every report to `ai`. These two
independent compatibility rules have drifted from the shared contract and can
both falsify provenance.

The source of truth for allowed current values remains the shared Skill type.
Safety reports are auxiliary metadata; install/update authorization remains
owned by the current package fingerprint and operation policy.

## `DES-SYNC191-001`: Shared compatibility normalizer

Add a pure helper in `packages/shared` that normalizes only
`safetyReport.scanMethod` before strict consumer validation:

| Input method    | Output                                        |
| --------------- | --------------------------------------------- |
| `ai`            | preserve report as `ai`                       |
| `preflight`     | preserve report as `preflight`                |
| legacy `static` | preserve report fields and map to `preflight` |
| unknown value   | omit the complete auxiliary report            |
| missing report  | leave the Skill unchanged                     |

The helper accepts unknown input and returns a shallowly normalized Skill-like
record. It must not coerce any other report field. Web's Zod schema continues
to reject malformed levels, findings, scores, timestamps, and types.

Desktop backup import and Web sync parsing use the same helper. The Web schema
then declares only the current shared values `ai | preflight`; legacy values
never reach the canonical parsed snapshot.

## `DES-SYNC191-002`: Consumer-boundary integration

`parseSyncSnapshot()` performs the compatibility pass immediately before its
existing strict snapshot normalization. It shallow-copies only:

- the root object when it contains a Skills array;
- the Skills array;
- Skills whose safety report requires migration or removal.

It leaves prompts, media maps, plugin packages, and other collections untouched
during this pass. Complexity is `O(s)` time for `s` Skills and `O(k)` additional
Skill objects for `k` reports that actually change.

The Desktop producer does not erase current `preflight` reports. This keeps
Desktop exports truthful and makes compatibility a receiving-boundary concern.

## `DES-SYNC191-003`: Trust and failure semantics

The parsed report remains display/history metadata. It does not create
`approvedPackageFingerprint`, does not change safety settings, and does not
skip install/update preflight.

Unknown scan methods fail closed for trust but fail open for backup
availability: the report is removed, while the Skill remains. Malformation in
any other required report field still rejects the snapshot.

Parsing completes before the backup repository write. A rejected snapshot
therefore leaves the previous remote snapshot and retention metadata unchanged.

## Test-First Design

The first red test is added to
`apps/web/src/services/sync-snapshot.test.ts` with the exact current
Desktop-shaped `preflight` payload. It must fail against the current
`ai | static` schema.

Required methods:

- black-box contract: Desktop-shaped payload accepted by Web;
- white-box branch: every method mapping and report absence;
- boundary/adversarial: unknown method, wrong type, invalid score, malformed
  finding, oversized Skill list at the existing snapshot bound;
- integration/failure: parse failure causes no repository write;
- trust regression: restored report does not populate operation approval.

No network dependency is needed. Fixtures stay in memory and use the real Zod
parser and backup service boundary.

## Affected Areas

- Shared contract utility: `packages/shared`
- Desktop backup import compatibility:
  `apps/desktop/src/renderer/services/database-backup-format.ts`
- Web sync parser and route/service tests: `apps/web`
- No SQLite schema, filesystem layout, IPC, or public route shape change

## Failure And Rollback

- External boundary: self-hosted backup route before repository persistence.
- Partial failure behavior: normalization or schema failure returns an error
  before write; no half-created snapshot is allowed.
- Recovery/rollback: users retain the previous remote snapshot; reverting the
  helper restores the old validation behavior without data migration.

## Analyze Result

- Requirement links: current shared type and stable Skill scan semantics agree
  on `ai | preflight`.
- Verification links: every changed branch maps to `TEST-SYNC191-*`.
- Blocking conflicts: none. The related #185 change addresses source identity
  and path portability, not safety provenance.
- Unresolved `[待确认]`: none.

## Traceability

| Requirement       | Design                               | Verification                           | Task                             |
| ----------------- | ------------------------------------ | -------------------------------------- | -------------------------------- |
| `FR-SYNC191-001`  | `DES-SYNC191-001`, `DES-SYNC191-002` | `TEST-SYNC191-001`                     | `T-SYNC191-001`, `T-SYNC191-002` |
| `FR-SYNC191-002`  | `DES-SYNC191-001`, `DES-SYNC191-003` | `TEST-SYNC191-002`, `TEST-SYNC191-003` | `T-SYNC191-001`, `T-SYNC191-002` |
| `FR-SYNC191-003`  | `DES-SYNC191-003`                    | `TEST-SYNC191-003`                     | `T-SYNC191-003`                  |
| `NFR-SYNC191-001` | `DES-SYNC191-002`                    | `TEST-SYNC191-004`                     | `T-SYNC191-004`                  |
