# Legacy Upgrade Recovery Evidence

## Evidence Sources

- GitHub issue bodies and maintainer/reporter comments for #89, #97, and #98.
- Repository tags v0.4.7, v0.4.8, v0.5.1, and v0.5.2.
- Current runtime-path, recovery-candidate, data-layout, upgrade-backup,
  portable-backup, database, IPC, renderer, and release-test code.

No user database or private backup was copied into the repository.

## Issue Matrix

| Issue | Historical report                                                                                                                         | Tagged evidence                                                                                                                                                                                                             | Current evidence                                                                                                                                                           | Audit conclusion                                                                                                                                  |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| #89   | Windows update made existing Prompts invisible; reporter later identified old install-directory `data` and new roaming `prompthub` paths. | v0.4.7 could select install-scoped `data`; v0.4.8 excluded the default `AppData\\Local\\Programs` install directory and selected roaming data. v0.5.1 later required existing data before selecting an install-scoped path. | Desktop recovery candidates include roaming/local name variants, `LocalAppData\\Programs\\PromptHub\\data`, and packaged install `data`; path tests assert this allowlist. | The historical path transition is credible. Current end-to-end discovery, preview, explicit recovery, and restart still require a tagged fixture. |
| #97   | A v0.5.1 backup could not be used in v0.5.2/0.5.3 and rollback failed.                                                                    | v0.5.1 and v0.5.2 portable backup formats both use format version 1 and contain explicit Prompt `versions`. v0.5.2 also introduced a separate automatic upgrade-snapshot directory and manifest.                            | Current code has portable import plus upgrade snapshot inventory/restore, insurance rollback, symlink rejection, pruning, and startup migration tests.                     | Treat the portable file and upgrade snapshot as separate fixtures. Existing unit tests are not a genuine tagged compatibility proof.              |
| #98   | After updating to v0.5.2 only the oldest and latest Prompt versions remained visible.                                                     | v0.5.1 and v0.5.2 portable formats carry a `versions` array; tagged code did not define an intentional oldest/latest-only contract.                                                                                         | Current database query returns every row ordered by version, IPC forwards that result, and UI tests render an intermediate version.                                        | The current query is not an evidenced root cause. Audit legacy import/migration identity and persistence with four distinguishable versions.      |

## Existing Coverage That Must Be Reused

- `apps/desktop/tests/unit/main/data-path.test.ts` covers current path selection
  and old-install upgrade scenarios.
- `apps/desktop/tests/unit/main/recovery-paths.test.ts` covers allowlisted Windows
  candidate paths and case-insensitive deduplication.
- `apps/desktop/tests/unit/main/recovery-candidates.test.ts` and
  `data-recovery.test.ts` cover candidate inspection and database recovery
  behavior.
- `apps/desktop/tests/unit/main/upgrade-backup-startup.test.ts` covers migration
  of a legacy v0.5.2 sibling snapshot.
- `apps/desktop/tests/unit/main/upgrade-backup-restore.test.ts` covers restore,
  insurance rollback, link rejection, and bounded snapshot retention.
- `apps/desktop/tests/e2e/backup-restore.spec.ts` covers the current portable
  backup pipeline, but only with a current-format generated fixture and a small
  Prompt history.
- `apps/desktop/tests/unit/components/prompt-version-history-modal.test.tsx`
  proves that the current renderer can display and act on an intermediate
  version supplied by the service.

## Missing Proof

1. No deterministic fixture currently executes the v0.4.7 install-directory
   layout through current recovery and restart.
2. No test imports a portable backup generated from the actual v0.5.1 contract
   and compares all durable records after restart.
3. No test carries four distinguishable legacy Prompt versions through the
   complete migration/import, IPC, UI, restart, and intermediate rollback path.
4. Current coverage does not establish resource bounds for large or adversarial
   legacy candidate trees; any touched traversal must add explicit limits.

## Decision

Start with the three missing fixtures. Preserve the existing recovery
architecture and make no production change for a path that already passes. A
fixture failure identifies the smallest owning boundary and becomes the required
pre-fix regression test.
