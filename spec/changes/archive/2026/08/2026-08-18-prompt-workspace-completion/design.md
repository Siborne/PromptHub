# Prompt Workspace Completion Design

<!-- traceability: enforced -->

## `DES-PWCOMP-001`: Multi-Message Persistence

Add nullable `messages_json` columns to `prompts` and `prompt_versions` plus a
validated shared `PromptMessage[]` contract. When present, the array is the
canonical authored sequence. Legacy `system_prompt` and `user_prompt` remain
transactionally maintained compatibility projections; migration constructs an
ordered sequence from existing non-empty fields without rewriting their bytes.

FTS receives a deterministic newline-joined text projection through existing
update paths. Export/sync payloads add optional messages for backward reading.
An old client can read the compatibility projection but cannot round-trip the
full sequence; the new client detects a legacy overwrite and creates a version
before accepting it rather than silently discarding messages.

## `DES-PWCOMP-002`: Startup Visibility

Add `is_startup_hidden INTEGER NOT NULL DEFAULT 0` to folders and shared/API
contracts. The initial unscoped Prompt selector excludes folders whose own or
ancestor flag is set. Folder navigation and explicit filters bypass that
startup-only predicate. Compute hidden descendants once with an ID set; list
filtering is `O(F + P)` for folders `F` and the loaded Prompt page `P`.

## `DES-PWCOMP-003`: Media Export

Add a desktop main service and minimal IPC that resolves an attachment through
the existing managed media contract, validates allowed roots, regular-file
type, detected MIME, and size, opens a native save dialog, then streams/copies
to a same-directory temporary destination followed by rename. Renderer buttons
pass an attachment identity, never an arbitrary source path.

Remote media must already be materialized through the existing import path;
export does not introduce a second downloader. Cancellation is a successful
no-op. Original files and Prompt rows are never changed.

## Failure And Rollback

- Schema migration is additive and idempotent; versions and prompt writes use
  existing transactions.
- Invalid message JSON rejects the changed record without clearing unrelated
  rows; legacy fields remain readable.
- Folder preference rollback ignores the additive column.
- Export failure cleans only its own temporary destination.

## Analyze Result

- The three tracks share Prompt contracts but remain separate task/commit
  units. No track is allowed to wait on the others for release.
- The existing image-generation workbench remains owner of generated batches;
  this change owns source Prompt attachment export only.

## Traceability

| Requirement      | Design                             | Verification                         | Task           |
| ---------------- | ---------------------------------- | ------------------------------------ | -------------- |
| `FR-PWCOMP-001`  | `DES-PWCOMP-001`                   | `TEST-PWCOMP-001`                    | `T-PWCOMP-002` |
| `FR-PWCOMP-002`  | `DES-PWCOMP-002`                   | `TEST-PWCOMP-002`                    | `T-PWCOMP-003` |
| `FR-PWCOMP-003`  | `DES-PWCOMP-003`                   | `TEST-PWCOMP-003`                    | `T-PWCOMP-004` |
| `NFR-PWCOMP-001` | `DES-PWCOMP-001`..`DES-PWCOMP-003` | `TEST-PWCOMP-001`..`TEST-PWCOMP-003` | `T-PWCOMP-005` |
