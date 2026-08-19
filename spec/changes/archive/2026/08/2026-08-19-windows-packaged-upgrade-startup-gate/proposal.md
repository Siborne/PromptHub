# Windows Packaged Upgrade Startup Gate

## Why

The published `0.6.0-beta.1` Windows package can fail during startup with
`EPERM: operation not permitted, fsync`. The release matrix packaged Windows
artifacts but did not launch the packaged application through an upgrade path,
so the release gate did not detect the failure.

The public prerelease was withdrawn to draft on 2026-08-14. It must remain
unpublished until a replacement candidate passes a real packaged Windows
upgrade cold start.

## Scope

- Repair file durability calls that flush read-only Windows handles.
- Cover canonical renderer-state staging, SQLite safety images, and raw
  database recovery evidence.
- Add a Windows x64 packaged upgrade cold-start smoke test to the release
  workflow.
- Record a late startup event only after the packaged renderer has loaded.
- Update the stable release gate and the withdrawn beta release record.
- Reuse the existing `v0.6.0-beta.1` tag and draft release for the verified
  replacement candidate, preserving draft-first publication and replacing
  assets in place only after the current candidate passes every release gate.

## Non-Goals

- Changing the storage layout or backup retention contract.
- Suppressing real file flush failures.
- Replacing Windows x64 execution evidence with a mocked unit test.
- Republishing any release before the new CI run completes.
- Deleting the existing draft or moving its tag before a clean, reproducible
  candidate commit and full platform evidence exist.

## Risk And Rollback

- Opening files with read/write access is required by Windows for durable
  flushes and does not change file content by itself.
- The smoke test uses an isolated temporary AppData tree, bounded startup
  timeout, and terminates only the process it starts.
- Rollback is removal of the handle-mode changes and the workflow step. That
  rollback would restore the known Windows startup defect and is therefore not
  release-safe.
- Reusing a published version rewrites the tag target and replaces draft assets.
  Before that destructive step, the exact old tag object, peeled commit, release
  id, asset names and digests must be recorded. The tag update must use an
  expected-old-value lease, and the draft must remain unpublished until every
  replacement asset and update manifest is verified.
