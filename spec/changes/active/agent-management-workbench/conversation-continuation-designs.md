# Agent Conversation Continuation Designs

This supporting design record defines the project-centered conversation
catalog, native resume, cross-Agent continuation, conversation management and
portable export extension of the Agent workbench. It does not create a second
native transcript store. Requirements remain authoritative in
`specs/agent-management/spec.md`, while implementation traceability remains in
`design.md` and `tasks.md`.

## Product Semantics

PromptHub exposes two deliberately different continuation actions:

| Action                   | Product label             | Meaning                                                                                                                                           |
| ------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native continuation      | Resume in original Agent  | Invoke the source Agent's verified native resume contract against the same native session.                                                        |
| Cross-Agent continuation | Continue in another Agent | Create a new target-Agent session in the same project and provide a portable, user-reviewed handoff context derived from the source conversation. |

Cross-Agent continuation is a lineage-preserving fork, not a claim that native
session ids, hidden reasoning, tool state, checkpoints or provider runtime can
be migrated between products.

## `DES-AGENT-081`: Project-Centered Conversation Catalog

The primary History surface is a project-centered catalog across all verified
Agent session adapters. The existing History tab inside one Agent remains a
filtered projection of the same catalog and MUST NOT own a second list, cache
or annotation store.

The first delivery reuses the existing local `SkillProject` registry as the
canonical PromptHub project registry. Its internal legacy type name is not
shown in conversation UI. No second project table is introduced in this
change. A conversation is associated only when its canonicalized working
directory exactly matches a registered project root or is a descendant of one.
Basename-only, substring and case-unsafe guesses are prohibited.

An unmatched conversation enters `needs-project` and appears in a dedicated
association queue. It remains readable and exportable, but native or
cross-Agent continuation requires the user to choose a concrete project first.
The selected `projectId` is PromptHub-owned metadata and survives rescans even
when the source path disappears. Project root changes re-resolve against the
same stable project id.

The catalog supports bounded pagination and filters for project, source Agent,
date, status, tags, favorites and text search. A row shows project, source
Agent, title, updated time, message count when known, and source availability.

## `DES-AGENT-082`: Conversation Identity And PromptHub-Owned CRUD

Native transcript bodies remain platform-owned and read-only. PromptHub CRUD
operates on a device-local conversation projection identified by source,
adapter version and external session id:

- **Create**: discover a native session through a verified adapter, or register
  the target result of a successful cross-Agent continuation. Blank synthetic
  histories are not supported.
- **Read**: list metadata and load the selected visible user/assistant
  transcript on demand through its live adapter.
- **Update**: edit PromptHub-owned title override, project association, tags,
  note, favorite and archive state. Source transcript text is never edited.
- **Delete**: after explicit confirmation, invoke only a verified adapter-owned
  native delete, then hard-delete the matching PromptHub metadata row.

Native deletion is the only destructive action. It is available only when a
platform adapter exposes a documented typed delete/cleanup plan with preview,
explicit confirmation and post-action verification. PromptHub never implements
native deletion by unlinking an arbitrary transcript file. A failed update,
archive or native delete leaves the previous metadata projection unchanged.

The persistence change extends the existing device-local session index rather
than introducing a transcript database. PromptHub-owned annotations include
`project_id`, `title_override`, `tags`, `note`, `favorite`, `archived_at` and
timestamps. Transcript bodies, absolute source paths and handoff payloads are
excluded from normal sync and backup unless a later explicit portability policy
is approved. The projection has no soft-delete or restore state.

## `DES-AGENT-083`: Native Resume Execution

The primary native action is **Resume in original Agent**, not merely Copy
command. The renderer sends a conversation identity; main resolves the current
adapter and obtains a fresh typed `AgentResumeCommand`. The renderer never
constructs or supplies an executable, arguments or working directory.

Before launch, main verifies:

1. the source session still exists and is readable;
2. the adapter still declares native resume support;
3. the executable resolves to the selected Agent's verified installation;
4. the resolved project directory remains an allowed existing directory; and
5. every argument is adapter-owned and size bounded.

Execution uses `execFile`/spawn argument arrays with `shell: false` and the
resolved project root as `cwd`. The explicit click is launch intent; no extra
confirmation is required unless the adapter declares an additional destructive
or billable side effect. Copy command remains a secondary menu action.

Success means the native process was accepted for launch. It does not fabricate
a new session row. The existing external session remains authoritative and a
later scan observes any updated timestamp or content. Stable failure categories
include `source-missing`, `resume-unsupported`, `agent-not-installed`,
`project-required`, `unsafe-working-directory`, `launch-rejected` and
`launch-failed`.

## `DES-AGENT-084`: Cross-Agent Handoff Plan And Apply

The **Continue in another Agent** action opens an Agent picker. The picker lists
enabled Agents with their exact continuation capability:

- `direct`: installed and has a verified project launch plus prompt injection
  contract;
- `launch`: can open the Agent but cannot safely inject context;
- `unavailable`: missing installation, unsupported launch or incompatible
  project state, with a reason.

The source Agent is excluded from this picker because native continuation has a
dedicated action. Choosing a target creates a preview-only handoff plan. The
plan contains:

- project identity and working directory;
- source Agent, model when known, title and timestamps;
- visible user/assistant transcript selected under a byte/token budget;
- deterministic sections for current objective, known decisions, completed
  work, pending work and referenced files when those values are available;
- truncation, parse and source-availability warnings; and
- an optional user-written continuation instruction.

The baseline plan is deterministic and does not require an AI call. Optional AI
summarization is a separate explicit action and cannot silently replace source
messages. The user can choose full visible context, recent turns or summary
only, review the exact payload, and cancel without side effects.

Apply delegates to a target-specific main/core adapter. Direct adapters may use
bounded stdin, a `0600` temporary prompt file or documented argument input;
they MUST NOT interpolate a shell command. Temporary payloads are deleted after
launch and are never synced. `launch` opens the target Agent without mutating
the clipboard and clearly reports that automatic injection was unavailable.

Cross-Agent success creates a new target session or a pending target launch; it
never mutates the source transcript. Partial failure records no false target
session id and preserves a retryable plan without retaining unrestricted
transcript text.

## `DES-AGENT-085`: Conversation Lineage

PromptHub records a device-local lineage edge for each applied handoff:

```ts
interface AgentConversationHandoff {
  id: string;
  projectId: string;
  sourceAgentId: string;
  sourceSessionId: string;
  targetAgentId: string;
  targetSessionId: string | null;
  mode: "direct" | "launch";
  status: "planned" | "launched" | "linked" | "failed" | "cancelled";
  payloadDigest: string;
  createdAt: number;
  updatedAt: number;
  stableErrorCode: string | null;
}
```

The edge stores identity, status and a digest, not the transcript or generated
handoff body. When the target adapter can return a session id it is linked
immediately. Otherwise a later bounded scan may offer an exact adapter-owned
correlation candidate for user confirmation; time proximity alone MUST NOT
silently link sessions.

Conversation detail shows **Continued from** and **Continued as** links. Deleting
or losing either native source does not cascade-delete the other conversation;
the lineage edge becomes partially unavailable and remains explainable.

## `DES-AGENT-086`: JSON And Markdown Export

Single and multi-select export support JSON and Markdown. Export reads the live
adapter at execution time and writes through a native save/directory dialog
using a staging file plus atomic rename where supported.

JSON uses a versioned, import-neutral envelope:

```json
{
  "schemaVersion": 1,
  "exportedAt": 0,
  "project": { "id": "", "name": "" },
  "source": { "agentId": "", "adapter": "", "sessionId": "" },
  "conversation": { "title": "", "createdAt": null, "updatedAt": null },
  "messages": [{ "role": "user", "timestamp": null, "text": "" }],
  "warnings": []
}
```

Markdown uses YAML frontmatter for the same non-secret metadata followed by
ordered `## User` / `## Assistant` sections. Batch Markdown export creates one
sanitized filename per conversation plus an index file; batch JSON may create
one file per conversation or one bounded array selected in the export dialog.

Exports include only visible user/assistant text by default. Hidden reasoning,
system prompts, tool payloads, credentials, environment values, native source
paths and absolute project paths are excluded. The user may explicitly include
the project path after a privacy warning. If the adapter reports truncation,
parse errors or a missing source, the preview names the limitation; a metadata-
only or partial export requires explicit acceptance and preserves warnings in
the output. Cancelling or failing an export leaves no final or staging file.

## `DES-AGENT-087`: History Workspace Interaction And Errors

The Agents workspace adds a primary **Conversation History** entry. Its desktop
layout is project navigation/filter, conversation list and transcript detail.
Agent detail History reuses the same component with `sourceAgentId` fixed.

Conversation detail actions are ordered by user intent:

1. **Resume in original Agent** when native resume is supported;
2. **Continue in another Agent** with an Agent dropdown;
3. **Export** with JSON/Markdown choices;
4. row-context continuation, export and adapter-gated confirmed delete actions.

The target dropdown shows Agent icon, name, installation state and continuation
mode. Selection opens a context preview before launch. It does not auto-launch
on selection. Keyboard navigation, focus restoration, screen-reader status,
reduced motion and narrow list-to-detail navigation follow the existing Agent
workspace contract.

Errors are local to the action and preserve user context. A transcript read
failure does not clear the selected row; a handoff failure keeps the reviewed
plan available for retry; an export failure keeps format/options selected; a
late project or Agent switch cannot overwrite the current view. The per-Agent
local-index toggle moves to History Source Settings so indexing diagnostics do
not compete with ordinary browsing.

## Verification Plan

- `TEST-AGENT-099`: project resolution, unmatched association, root rename and
  cross-Agent catalog pagination/search against real SQLite.
- `TEST-AGENT-100`: CRUD state machine, archive and annotation preservation,
  metadata hard deletion, native failure behavior and capability gating.
- `TEST-AGENT-101`: native resume preflight, typed execution, unsafe cwd,
  missing source/executable and launch failure without shell construction.
- `TEST-AGENT-102`: target capability matrix and handoff preview for full,
  recent-turn and summary-only modes, including Unicode and oversized input.
- `TEST-AGENT-103`: direct and launch-only apply, temporary-file cleanup,
  cancellation and partial-failure rollback.
- `TEST-AGENT-104`: lineage creation, exact linking, retry, missing endpoints
  and no time-only silent correlation.
- `TEST-AGENT-105`: JSON/Markdown golden fixtures, redaction, partial export,
  batch filename safety, cancellation and atomic-write failure.
- `TEST-AGENT-106`: renderer project/Agent filtering, action hierarchy, target
  dropdown, preview, errors, keyboard/focus, narrow layout and seven locales.
