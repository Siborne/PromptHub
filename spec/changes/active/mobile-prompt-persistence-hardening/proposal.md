# Mobile Prompt Persistence Hardening Proposal

## Why

The mobile app currently persists Prompt records in Expo SQLite even though the
original mobile shell change explicitly deferred durable storage. The shipped
code also exposes edit and delete workflows without the verification and safety
behavior required for durable user data.

## Scope

- Establish the mobile SQLite database as a mobile-owned sandbox data source.
- Add an explicit schema version and idempotent initialization contract.
- Test Prompt CRUD and malformed stored metadata against real SQLite.
- Refresh Prompt details whenever the route regains focus.
- Require confirmation before permanent deletion.
- Make Prompt search and filters functional and remove misleading inert actions.
- Localize all new Prompt workflow copy in the seven supported locales.

## Non-Goals

- Directly opening or sharing the desktop `prompthub.db` file.
- Desktop/mobile database-file compatibility.
- Cloud or WebDAV synchronization.
- Prompt version history on mobile.

## Risks And Rollback

- Existing mobile databases have `PRAGMA user_version = 0`; initialization must
  adopt them without deleting rows.
- Invalid legacy JSON must not prevent the Prompt list from loading.
- Rollback may remove the new UI behavior, but must not delete the mobile
  database or downgrade its schema version destructively.
