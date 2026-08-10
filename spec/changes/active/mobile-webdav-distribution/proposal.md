# Mobile WebDAV Distribution Proposal

## Phase And Status

- Phase: analyze
- Status: design-ready
- Primary requirements: `FR-MOBILEWD-001`, `FR-MOBILEWD-002`, `FR-MOBILEWD-003`
- Related issue: #15
- Exit condition: mobile builds can browse/copy local Prompts and explicitly
  exchange a portable snapshot through WebDAV with tested Android/iOS artifacts.

## Why

The repository already contains a mobile shell and local persistence work, but
the original request also requires WebDAV data exchange and distributable
Android/iOS builds. Mobile must not open or synchronize the desktop SQLite file
directly because platform storage, migrations, locking, and credentials differ.

## Scope

- Mobile Prompt browse, search, detail, and copy using the mobile local store.
- Explicit WebDAV pull/push of the canonical portable Prompt snapshot.
- Secure credential storage, conflict preview, offline behavior, and bounded
  media transfer.
- Android APK/AAB and iOS archive/TestFlight-ready release verification.
- Full desktop feature parity and continuous background sync are out of scope.

## Risks And Rollback

- Whole-snapshot exchange can conflict; the first release requires explicit
  local/remote choice and creates a local recovery point before import.
- Mobile storage/network quotas are smaller; transfer and extraction are
  streamed and capacity-checked.
- Removing a WebDAV account leaves imported local Prompts intact and deletes
  credentials only after confirmation.

## Related Records

- `spec/knowledge/behavior/mobile.md`
- `spec/knowledge/behavior/sync.md`
- `spec/changes/active/mobile-native-shell/`
- `spec/changes/active/mobile-prompt-hardening/`
