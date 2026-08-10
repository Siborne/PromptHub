# Desktop Language Startup Persistence

## Problem

The desktop renderer can reopen in English even when Electron reports a Chinese
system locale. Language is persisted in both the renderer Zustand store and the
main-process SQLite settings table, but startup currently treats a renderer
default created without persisted storage as if it were an explicit user
choice. That temporary value can overwrite SQLite, while the later main-process
settings load does not restore `language` into the renderer.

## Scope

- Preserve an explicit renderer-persisted language as the compatibility-first
  preference.
- When renderer persistence has no language, restore the validated language
  returned by the existing main-process settings contract.
- Prevent a temporary renderer default from being written to SQLite during
  hydration.
- Add focused renderer-store regression coverage.

## Non-goals

- No SQLite schema or IPC contract change.
- No automatic rewrite of an existing explicit language preference.
- No locale resource or product-copy changes.

## Risk And Rollback

The change only affects startup precedence for the existing `language` field.
Rollback is removal of the persisted-language guard and main-language restore.
No durable data migration is required.
