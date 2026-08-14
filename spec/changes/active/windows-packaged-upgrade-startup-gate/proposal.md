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

## Non-Goals

- Changing the storage layout or backup retention contract.
- Suppressing real file flush failures.
- Replacing Windows x64 execution evidence with a mocked unit test.
- Republishing any release before the new CI run completes.

## Risk And Rollback

- Opening files with read/write access is required by Windows for durable
  flushes and does not change file content by itself.
- The smoke test uses an isolated temporary AppData tree, bounded startup
  timeout, and terminates only the process it starts.
- Rollback is removal of the handle-mode changes and the workflow step. That
  rollback would restore the known Windows startup defect and is therefore not
  release-safe.
