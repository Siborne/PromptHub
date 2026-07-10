# Mobile Prompt Persistence Hardening Design

## `DES-MOBILE-001` Storage Ownership And Schema

- `apps/mobile/src/storage/database.ts` owns asynchronous database opening;
  `mobileSchema.ts` owns the schema and `PRAGMA user_version` boundary.
- `apps/mobile/src/features/prompts/data/promptRepository.ts` owns Prompt row
  mapping and CRUD for the mobile database.
- Prompt screens own transient form and filter state, not durable business
  rules.
- Shared Prompt types remain semantic contracts only; the desktop DB schema is
  not imported into React Native.

## Data Contract

The first mobile schema remains a focused Prompt table. Initialization uses a
transaction, creates missing tables and indexes, and advances `user_version`
only after the schema statements succeed. Version `0` is treated as the
already-shipped unversioned mobile schema and adopted in place.

Database opening, schema initialization, and repository queries use the Expo
SQLite asynchronous API. This keeps the web preview responsive and avoids the
worker timeout produced by synchronous SQLite calls.

Stored `tags` JSON is external persisted input. Row mapping accepts only arrays
of strings and falls back to an empty array for malformed or incompatible data.

## `DES-MOBILE-002` Cross-Platform Lifecycle Feedback

Validation, operation failures, and destructive confirmation use native Alert
surfaces on iOS/Android and browser alert/confirmation surfaces on web.

## `DES-MOBILE-003` Focus Refresh

Prompt detail reloads through the Expo Router focus lifecycle rather than only
loading during the initial component mount.

## `DES-MOBILE-004` Functional Workbench Controls

- Search is a real `TextInput`; filters use stable identifiers independent of
  translated labels.
- Decorative trailing state icons are not nested press targets.

## `DES-MOBILE-005` Localized Workflow

All Prompt workflow state and action text uses the existing seven-locale i18n
resource boundary. Stable filter identifiers never depend on translated labels.

## Verification Strategy

Node 24 `node:sqlite` supplies a real in-memory SQLite adapter with the same
SQL semantics used by Expo SQLite, wrapped behind the asynchronous repository
contract. This verifies stored rows and schema state without mocking SQL
results. UI-independent filtering and platform-alert policy are tested as pure
modules; navigation behavior is protected through the focus-lifecycle
implementation and Expo web verification.

## Traceability

| Requirement | Design | Verification |
| --- | --- | --- |
| `FR-MOBILE-001` | `DES-MOBILE-001` | `TEST-MOBILE-001`, `TEST-MOBILE-002` |
| `FR-MOBILE-002` | `DES-MOBILE-002` | `TEST-MOBILE-001`, `TEST-MOBILE-004`, `TEST-MOBILE-005` |
| `FR-MOBILE-003` | `DES-MOBILE-003` | `TEST-MOBILE-005` |
| `FR-MOBILE-004` | `DES-MOBILE-004` | `TEST-MOBILE-003`, `TEST-MOBILE-005` |
| `FR-MOBILE-005` | `DES-MOBILE-005` | `TEST-MOBILE-004`, `TEST-MOBILE-005` |
