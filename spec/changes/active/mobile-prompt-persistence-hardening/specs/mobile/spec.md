# Mobile Prompt Persistence Hardening Delta Spec

## Added Requirements

### `FR-MOBILE-001` Mobile-Owned Durable Storage

The mobile app shall store Prompt records in an Expo SQLite database owned by
the mobile application sandbox. The database file is not a portable substitute
for the desktop database.

#### `SC-MOBILE-001` Existing unversioned mobile database

Given a mobile database has the initial Prompt table and `user_version = 0`
When initialization runs
Then existing Prompt rows remain intact
And `user_version` becomes the current mobile schema version.

### `FR-MOBILE-002` Safe Prompt Lifecycle

Prompt create and edit operations shall persist validated values. Permanent
deletion shall require explicit user confirmation.

#### `SC-MOBILE-002` User cancels deletion

Given a Prompt detail is open
When the user dismisses the deletion confirmation
Then the Prompt remains stored.

#### `SC-MOBILE-003` User confirms deletion

Given a Prompt detail is open
When the user confirms deletion
Then the Prompt is removed and the list route becomes visible.

### `FR-MOBILE-003` Focus Refresh

When a Prompt detail route regains focus after editing, it shall reload the
record from SQLite and display the persisted values.

### `FR-MOBILE-004` Functional Discovery Controls

Prompt search and filter controls shall change the visible Prompt list. A
control without an implemented command shall not be rendered as actionable.

### `FR-MOBILE-005` Localized Workflow

Prompt detail, edit, validation, confirmation, loading, empty, and error copy
shall use i18n keys for all seven supported locales.

## Verification

- `TEST-MOBILE-001`: Real in-memory SQLite CRUD, schema adoption, future-version
  refusal, retry, and rollback tests.
- `TEST-MOBILE-002`: Malformed persisted metadata fallback tests.
- `TEST-MOBILE-003`: Search/filter behavior tests covering all, favorite,
  recent, tags, and case-insensitive matching.
- `TEST-MOBILE-004`: Platform alert and confirmation behavior tests.
- `TEST-MOBILE-005`: Mobile typecheck, focused coverage, Expo export, and
  browser workflow verification.

## Traceability

| Requirement | Scenarios | Design | Verification | Task |
| --- | --- | --- | --- | --- |
| `FR-MOBILE-001` | `SC-MOBILE-001` | `DES-MOBILE-001` | `TEST-MOBILE-001`, `TEST-MOBILE-002` | `T-MOBILE-001`, `T-MOBILE-002` |
| `FR-MOBILE-002` | `SC-MOBILE-002`, `SC-MOBILE-003` | `DES-MOBILE-002` | `TEST-MOBILE-001`, `TEST-MOBILE-004`, `TEST-MOBILE-005` | `T-MOBILE-003`, `T-MOBILE-004` |
| `FR-MOBILE-003` | - | `DES-MOBILE-003` | `TEST-MOBILE-005` | `T-MOBILE-005` |
| `FR-MOBILE-004` | - | `DES-MOBILE-004` | `TEST-MOBILE-003`, `TEST-MOBILE-005` | `T-MOBILE-006`, `T-MOBILE-007` |
| `FR-MOBILE-005` | - | `DES-MOBILE-005` | `TEST-MOBILE-004`, `TEST-MOBILE-005` | `T-MOBILE-008` |
