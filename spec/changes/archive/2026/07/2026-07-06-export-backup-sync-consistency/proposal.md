# Proposal

## Why

Current PromptHub export, backup, and sync flows no longer share a single durable payload contract:

- Web `/api/sync/*` accepts a richer snapshot shape than web `/api/import`.
- Desktop selective ZIP export embeds `import-with-prompthub.json`, but that JSON is currently a slim export envelope rather than a truly re-importable full snapshot.
- Desktop self-hosted sync, manual backup JSON/GZIP, manual ZIP export, and web import/export are drifting on optional fields like media payloads, `settingsUpdatedAt`, and skill/rule coverage.

This creates a real risk that data exported from one entry point cannot be faithfully restored through another.

## Scope

- Unify web import/export parsing around the same snapshot normalization used by sync.
- Align missing imported settings fallback with the shared web `DEFAULT_SETTINGS` contract across import and sync entry points.
- Ensure desktop ZIP export embeds a re-importable full PromptHub snapshot in `import-with-prompthub.json`.
- Preserve compatibility with existing PromptHub backup/export envelopes and legacy prompt version fields.
- Make desktop data settings clearly mark unavailable sync capabilities instead of implying that unimplemented S3 or save-triggered sync actions already work.
- Add regression coverage for JSON export/import, ZIP export/import, and self-hosted/web sync payload consistency.

## Risks

- Tightening import parsing can expose malformed historical payloads that were previously accepted accidentally.
- Changing ZIP embedded JSON shape must not break current desktop restore flows that already expect `import-with-prompthub.json`.

## Rollback

- Revert the shared snapshot parser adoption in web import/export.
- Revert selective ZIP embedded JSON generation back to the previous export envelope if compatibility issues appear.

## Impacted User Flows

- Desktop manual backup and restore.
- Desktop selective ZIP export and later restore/import.
- Desktop self-hosted push/pull.
- Web `/api/import`, `/api/export`, and `/api/sync/*` data interchange.
- Desktop data settings for WebDAV and S3 availability disclosure.
