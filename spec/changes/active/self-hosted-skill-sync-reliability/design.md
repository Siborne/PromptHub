# Design

## `DES-SS-001` Portable serialization boundary

Add a desktop-only sanitizer before constructing `WebSyncPayload`. Source and content URLs are portable only when they parse as `http:` or `https:`; icon URLs also allow supported `data:image/*` values. For non-portable values, remove the field and always remove `local_repo_path`; do not mutate the local `DatabaseBackup` returned by `exportDatabase`.

## `DES-SS-002` Portable identity and canonical IDs

Normalize a Skill identity as:

1. non-empty `source_id`;
2. a durable package/content fingerprint when present;
3. lower-cased trimmed name for legacy records without a stable identity. This fallback intentionally joins a local path import with the same Skill after it has been stored by Web, because the path and generated desktop IDs are machine-specific. Same-name variants that carry `source_id` remain separate.

Merge local and remote lists by this identity and choose the newest record by `updated_at`, with the remote record winning ties. Build a source-ID map from every input record to the selected record ID.

## `DES-SS-003` Dependent snapshot remapping

Remap `skillVersions.skillId` and `skillFiles` keys through the source-ID map before restore. Merge same-version records after remapping and retain the newest snapshot. Drop orphaned file/version entries instead of passing IDs that do not appear in the merged Skill list.

The Web `skillSchema` must explicitly model the portable Skill source and fingerprint fields so Zod validation does not strip them before persistence/export.

## Error and compatibility behavior

Older Web snapshots may contain local paths or duplicate Skill IDs. Desktop pull normalizes those snapshots before restore. Web continues to reject unsafe or non-HTTP metadata received from other clients; the desktop sanitizer is the compatibility boundary for local imports.
