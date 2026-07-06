# Proposal

## Why

Recent sync abstraction work left several WebDAV follow-up gaps in the web implementation:

- WebDAV pull masked non-404 remote failures as "backup missing", hiding auth and server errors.
- WebDAV push reported success even if `manifest.json` upload failed.
- WebDAV backup payloads silently omitted media bytes while preserving prompt media references.
- The route/client contract drifted after `summary` was introduced as the unified sync response surface.

## Scope

- Fix WebDAV push/pull error classification and success criteria in the web sync orchestrator.
- Restore media-complete WebDAV backup layout for web sync (`data.json` + `manifest.json` + media files).
- Re-align web sync route/client response types with the unified `summary` contract.
- Add regression tests for auth failures, legacy fallback, manifest handling, and media round-trip.

## Risks

- Media-complete WebDAV sync now touches on-disk asset files, so path validation must remain strict.
- Tightening manifest requirements can surface previously hidden broken remote states as user-visible failures.

## Rollback

- Revert the new WebDAV media layout handling and fall back to JSON-only payloads.
- Restore the previous loose pull fallback logic if compatibility issues appear in the field.

## Impacted User Flows

- Web user pushes workspace backups to WebDAV.
- Web user pulls workspace backups from WebDAV.
- Desktop or web clients consume the shared `/api/sync/*` response contract.
