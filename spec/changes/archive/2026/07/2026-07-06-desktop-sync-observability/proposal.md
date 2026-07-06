# Desktop Sync Observability

## Why

Desktop automatic sync currently has poor user-visible observability. Startup,
startup-resume, and interval sync only write success messages to the developer
console when debug mode is enabled, while failures only appear in console
errors. Users cannot tell whether WebDAV, S3, or self-hosted sync ran, skipped,
or failed.

## Scope

- Record a small, non-sensitive automatic sync history for desktop sync runs.
- Cover WebDAV, S3, and self-hosted automatic sync.
- Surface recent records in desktop data settings.
- Avoid storing provider credentials, URLs, tokens, passwords, or payload data.

## Out Of Scope

- Changing sync conflict resolution semantics.
- Changing remote backup formats.
- Adding a full log viewer or exporting logs.
- Adding new IPC channels.

## Risks

- Sync records must not leak secrets.
- Sync history writes must not block or fail the sync itself.
- UI should stay compact and not make provider settings harder to scan.
