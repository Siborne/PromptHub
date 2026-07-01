# Design

## Approach

Add a renderer-side `sync-history` service that stores a bounded list of recent
automatic sync attempts through the existing settings bridge. This avoids a new
IPC contract while keeping history durable across app restarts.

For local troubleshooting, the same sanitized entry is also appended to one
workspace log file:

- `logs/auto-sync.jsonl`

The file is newline-delimited JSON, one sync attempt per line. PromptHub does
not create one file per attempt.

## Data Shape

Each entry stores:

- `id`
- `provider`: `webdav | s3 | self-hosted`
- `reason`: `startup | startup-resume | interval`
- `status`: `success | failed | skipped`
- `startedAt`
- `finishedAt`
- `message`
- `localChanged`

The history is capped to 20 entries.

## Security

The record boundary stores only provider identity, run reason, timestamps, run
status, and sanitized result text. It must not store URL, username, password,
token, bucket name, remote path, or request payload.

## UI

Desktop data settings renders a compact "Automatic sync history" section on
cloud sync subsections. It shows the newest entries first and a clear empty
state when no automatic sync has run yet.

The local data paths section exposes the `auto-sync.jsonl` path so users can
open the log file from the same place as application logs.

## Compatibility

Existing settings files without history are treated as empty history. Invalid
history payloads are ignored.

The log file is created on demand under the existing `logs/` directory.
