# Startup Log Noise

## Why

Development startup currently prints several messages that look like app errors even when the app is healthy:

- Chromium DevTools internal `Autofill.*` / `language-mismatch` console errors when DevTools opens automatically.
- Browserslist stale data warnings on every Vite startup.
- Pre-migration database backups on every startup even when no migration is pending.

## Scope

- Keep real startup failures visible.
- Reduce repeat noise in local development.
- Avoid changing production recovery behavior except preventing unnecessary database backup files when the schema is already current.

