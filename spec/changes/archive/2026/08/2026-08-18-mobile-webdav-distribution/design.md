# Mobile WebDAV Distribution Design

<!-- traceability: enforced -->

## `DES-MOBILEWD-001`: Local Mobile Source Of Truth

Keep the mobile app's SQLite sandbox as the runtime source of truth. Shared
Prompt and portable-snapshot types live in `packages/shared`; import/export and
validation business rules live in `packages/core` only when runtime-neutral.
Native file, network, secure-store, and share/copy adapters remain in the mobile
application layer. The mobile app never mounts or edits a desktop database.

List/search uses indexed, paginated queries and renders only the active page.
Copy reads the selected Prompt projection rather than preloading all Prompt
bodies. This keeps list work `O(pageSize)` in memory.

## `DES-MOBILEWD-002`: WebDAV Transfer State Machine

Use the existing canonical portable snapshot schema, not a new mobile payload.
The adapter performs `PROPFIND`/metadata discovery and streamed `GET`/temporary
upload plus atomic `MOVE` where the server supports it. ETag or snapshot
revision is a precondition for overwrite. Provider calls have explicit timeout,
cancellation, bounded retry/backoff for idempotent requests, and no background
infinite polling.

Pull downloads into an app-owned temporary file, validates encryption/integrity,
manifest/schema/counts/archive paths and storage quota, then shows local/remote
metadata. On confirmation it creates a local checkpoint and imports through a
transaction. Push exports a consistent local snapshot and commits remotely only
after full upload. Failure cleans only task-owned temporary data.

## `DES-MOBILEWD-003`: Distribution Gate

Extend release automation with separately signed Android and iOS artifacts.
Secrets stay in protected release environments. A platform matrix installs an
older supported build, seeds fixture data, upgrades to the candidate, and
verifies local data, offline startup, secure credentials, WebDAV exchange, and
copy behavior. iOS public distribution depends on Apple signing/review access;
the repository gate records rather than hides that external prerequisite.

## Analyze Result

- Existing mobile shell/persistence changes do not include WebDAV or release
  distribution, so this change adds rather than duplicates their boundary.
- Whole-snapshot conflict choice is intentionally simpler than record-level
  background sync and avoids an unproven mobile merge engine.

## Traceability

| Requirement        | Design                                 | Verification                             | Task             |
| ------------------ | -------------------------------------- | ---------------------------------------- | ---------------- |
| `FR-MOBILEWD-001`  | `DES-MOBILEWD-001`                     | `TEST-MOBILEWD-001`                      | `T-MOBILEWD-002` |
| `FR-MOBILEWD-002`  | `DES-MOBILEWD-002`                     | `TEST-MOBILEWD-002`                      | `T-MOBILEWD-003` |
| `FR-MOBILEWD-003`  | `DES-MOBILEWD-003`                     | `TEST-MOBILEWD-003`                      | `T-MOBILEWD-004` |
| `NFR-MOBILEWD-001` | `DES-MOBILEWD-001`..`DES-MOBILEWD-003` | `TEST-MOBILEWD-001`..`TEST-MOBILEWD-003` | `T-MOBILEWD-005` |
