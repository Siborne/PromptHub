# Sync Requirements

## `FR-SS-001` Portable Skill metadata

When desktop pushes a Skill whose `source_url`, `content_url`, or `icon_url` is a local path, the self-hosted payload MUST omit that field (and any machine-local repository path). HTTP(S) source metadata and supported image data URLs MAY be retained. The Skill content and file snapshots MUST remain in the payload.

The Web sync parser MUST retain portable source identity, branch/path, package fingerprint, and source-binding fields instead of silently dropping them during validation.

## `FR-SS-002` Stable Skill reconciliation

When local and remote snapshots represent the same Skill but carry different database IDs, pull merge MUST produce one Skill. Identity priority is `source_id`, then a durable package/content fingerprint, then normalized name for local/legacy records. Same-name variants that carry distinct `source_id` values MUST remain separate.

## `FR-SS-003` Snapshot remapping

After Skill identity reconciliation, `skillVersions` and `skillFiles` MUST refer only to the selected Skill record IDs. A repeated pull MUST not attempt to create a duplicate name or write files for a missing Skill.

### Acceptance scenarios

- local scan/import with `/Users/.../skill` can be pushed to Web without `source_url must use HTTP(S)`;
- a pull followed by a second pull restores one `dev-review` Skill and all `SKILL.md`/resource files without file errors;
- remote HTTP(S) source URLs survive push/pull unchanged;
- local-only and remote-only Skills remain present after a merge.
