# Agent Management Session Index Designs

This file is a supporting design record within
`spec/changes/active/agent-management-workbench/`. It does not create a
parallel change, platform inventory, transcript store, or session source of
truth. The architecture and traceability table remain in `design.md`.

## `DES-AGENT-045`: Device-Local Session Metadata Persistence

`packages/db` owns two device-local persistence primitives:

- `agent_session_sources` records one verified adapter/root registration,
  adapter version, opt-in state, opaque scan cursor, last scan result and a
  stable error code.
- `agent_session_index` records redacted metadata for one external session,
  source file identity, status and PromptHub-owned tags/note.

External transcripts remain the source of truth. PromptHub never stores a
transcript body in either table and never modifies an external transcript or
authentication cache. A disappearing source file changes the metadata row to
`missing` while retaining PromptHub-owned tags and note.

Source identity is unique by `platform_id`, `root_path` and `adapter_id`.
Session identity is unique by `source_id` and the adapter-provided external id.
The DB boundary accepts only bounded strings, non-negative sizes/counts,
finite timestamps, unique scan records and serializable annotations. Paths are
device-local values and reject null bytes; they are excluded from normal sync
and export.

A scan commit is one SQLite transaction. Incremental commits upsert only
observed records. Full commits first mark the source inventory missing and
then restore observed rows to their supplied status, preserving annotations.
The source cursor and last-result fields update only in the same transaction.
Validation or write failure leaves both source and index unchanged. A failed
scan records only the stable failure state and does not rewrite indexed rows.

Listing uses indexed source/status/update columns, parameterized literal
search and bounded `limit`/`offset`. A scan is `O(n)` time for `n` supplied
records and `O(n)` validation memory; listing is `O(page size)` result memory.
No transcript directory traversal, network request, unbounded retry or
renderer exposure is introduced by this storage batch.

## `DES-AGENT-046`: Application-Configured Session Index Orchestration

The desktop main process owns one orchestration service between verified
read-only session adapters and `AgentSessionIndexDB`. The first persistent
index adapters are Claude Code and Gemini CLI because both already have
bounded local readers and stable PromptHub root resolution.

The application-level history acceleration preference controls supported
sources and defaults to enabled under `DES-AGENT-130`. Opening a supported
History reconciles exactly one source registration. Under `DES-AGENT-132`, a
fresh completed index is reused, while a missing or stale source performs one
deduplicated bounded background refresh only after the first list settles.
Disabling the application preference reconciles the source to disabled and
keeps list/detail requests on the live read-only adapter.

Each scan enumerates only the adapter's bounded session directory shape, never
the whole Agent root. It compares source path, mtime, size, stored digest and
adapter version with the previous index. Unchanged metadata is reused;
changed bounded prefixes are reparsed and re-digested. A full scan marks
unobserved rows missing in the same transaction while retaining PromptHub
annotations. Malformed files become per-file `parse-error` rows and make the
scan partial instead of aborting the inventory.

Cancellation is cooperative between directory entries and before commit. A
cancelled scan writes neither rows, cursor nor failure state. Non-cancellation
failures record only a stable error code and preserve the previous index.
Progress is a bounded in-process callback in this batch; renderer progress and
cancel IPC remain part of the later UI wiring of the same design.

Indexed list/search reads use bounded SQLite pagination. Transcript detail
always delegates to the live adapter and therefore fails source-missing rather
than fabricating content from the index. Resume commands are derived from the
verified adapter contract; transcript bodies and previews are not persisted.

For `n` source files, enumeration and validation are `O(n)` time with
`O(n)` bounded metadata memory and a hard 10,000-record cap. Each prefix read
is at most 256 KiB, scan concurrency is one, and SQLite commit is one
transaction. List/search result memory is `O(page size)` with a 200-row cap.

## `DES-AGENT-047`: Session Index IPC And Renderer Coordination

The renderer receives only a redacted index state: supported, enabled,
last scan status/time and stable error code. Source ids, root paths, cursors,
digests and indexed device-local paths remain main-process data. Existing
session list/detail contracts remain compatible; list gains an optional search
argument and detail still reads the external source on demand.

General Settings owns the explicit binary preference. Supported History views
apply it automatically: enabling registers the source and starts one scoped
refresh, while disabling stops persistent refreshes but retains the
rebuildable device-local index so annotations are not discarded. Individual
History panels expose no indexing toggle or manual refresh icon.

Each refresh has a renderer-generated request id. Main scopes its
`AbortController` by renderer sender id plus request id, rejects duplicate
in-flight ids, aborts when the renderer is destroyed, and removes controller
state in `finally`. Progress events contain only request id, platform id and
bounded processed/total counts. Cancellation from another renderer cannot
affect the request.

The Sessions page subscribes once, filters progress by its active request and
Agent, cancels an in-flight scan on unmount and unsubscribes. Index progress is
not a conversation-browser control. Indexed search runs through SQLite only
after the user submits the draft with Enter; typing performs no list request.
Search matches only session title and project identity, while disabled sources preserve
the existing live-reader fallback with the same final metadata predicate. Agent
changes invalidate late list, refresh and progress results.

## `DES-AGENT-053`: Cancellation Commit Barrier And Scale Verification

The index orchestration owns a stable abort guard rather than throwing
`AbortSignal.reason`. This keeps renderer-provided reason strings out of
stored failure state and guarantees every cancellation is classified as the
same `AbortError` with `AGENT_SESSION_SCAN_CANCELLED`.

Refresh checks the signal before loading prior metadata, before and after each
bounded SQLite page, and again after the asynchronous adapter scan resolves.
The final check is immediately adjacent to the synchronous SQLite transaction,
so no event-loop turn exists between the cancellation barrier and commit.
Abort errors bypass `recordScanFailure`; non-abort failures retain the existing
stable failure behavior.

The scale gate uses the real SQLite adapter and commits exactly 10,000 metadata
rows in one transaction. It then traverses all 50 pages at the 200-row cap,
checks total/has-more semantics, literal Unicode search and the absence of
body/content/transcript columns. Runtime is measured against a broad
30-second ceiling; the current implementation remains `O(n)` validation and
write work with `O(page size)` query result memory. No network call, retry,
background process, transcript copy or new cache is added.

## `DES-AGENT-064`: Qwen Deep-Page Detail Continuity

The Qwen live adapter keeps a bounded, process-local metadata window so every
session returned by the most recent native page remains openable even when its
position is beyond the first 200 rows. Native JSONL remains authoritative; the
window stores no transcript body and is capped at 256 entries with FIFO
eviction.

Listing still performs one bounded `qwen sessions list --json --limit N`
command and retains only the newest bounded metadata tail. Detail first uses
that window, then falls back to the existing 200-row native lookup for direct
requests. Before reading, it resolves the cached source path again beneath
`QWEN_RUNTIME_DIR`, so removal, replacement and symlink escape fail closed.

For a requested page ending at row `n`, native enumeration remains `O(n)` time
and bounded by the existing 2,000-row request and 2 MiB process-output gates.
Metadata memory is `O(1)` with a 256-entry ceiling; detail reads one selected
transcript prefix and does not traverse the runtime tree.
