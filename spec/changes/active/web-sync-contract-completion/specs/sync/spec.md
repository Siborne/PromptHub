# Sync Contract Delta

## Requirements

### `FR-SYNC-001` Canonical snapshot fields

The canonical sync snapshot may contain `promptRelations` and
`outputFormatItems`. Every provider that claims to export a complete user
snapshot MUST preserve these fields when present.

### `FR-SYNC-002` Local backup round trip

Desktop backup export MUST include prompt relations and output format items.
Desktop restore MUST recreate those records with their original IDs when the
referenced prompts exist. If the main-process direct-insert bridge is
unavailable for a graph-bearing payload, restore MUST fail before clearing
local data rather than recreating records with new IDs. A payload that omits
either optional field remains valid for backward compatibility.

### `FR-SYNC-003` Restore dependencies

Restore MUST reject or skip dependent relations/output items whose prompt IDs
are not present in the restored visible prompt set. It MUST NOT create dangling
references or claim a complete restore when dependent records were discarded;
the import result MUST expose skipped dependency counts.

### `FR-SYNC-004` Self-hosted Web round trip

Desktop-to-Web push and Web-to-desktop pull MUST carry prompt relations and
output format items. Web export/import MUST enforce the existing visibility
boundary for every referenced prompt.

### `FR-SYNC-005` WebDAV and S3 round trip

Structured and incremental WebDAV/S3 backup payloads MUST carry the same two
fields so provider choice does not change the restored prompt graph.

### `FR-SYNC-006` Legacy compatibility

Older snapshots without the new fields MUST still parse and restore all fields
they contain. Invalid dependent records MUST be handled deterministically and
reported through the existing import summary/error path, including skipped
relation and output-format counts.

### `FR-SYNC-007` Incremental integrity preflight

Incremental WebDAV/S3 downloads MUST verify the serialized data payload against
the manifest data hash and verify every manifest-listed media payload against
its declared hash and size before importing database records. A mismatch or
missing media file MUST fail the operation before local data is cleared or
written.

### `FR-SYNC-008` Freshness coverage

Automatic sync freshness checks MUST consider durable local changes to Skills,
Rules, prompt relations, output-format items, MCP/Plugin/agent snapshots,
media references, and settings in addition to Prompts and Folders. A failure
to read a required freshness source MUST produce an explicit sync failure.

## Acceptance scenarios

1. Export a prompt graph containing one relation and one output format item;
   import it into an empty database; both records retain their IDs.
2. Push the same graph to self-hosted Web and pull it into a second desktop;
   relations and output formats are present and point at visible prompts.
3. Export and restore through WebDAV/S3 incremental data; the two records are
   present in the restored snapshot.
4. Import a legacy payload with neither field; import succeeds without creating
   empty placeholder records.
5. Import a payload containing a relation to a missing prompt; no dangling
   relation is written and the result remains diagnosable.
6. Corrupt incremental data or media after manifest creation; download fails
   before `restoreFromBackup` is called.
7. Change a Skill, Rule, prompt relation, output format, or agent snapshot while
   Prompts and Folders are unchanged; auto sync treats the workspace as locally
   changed.
