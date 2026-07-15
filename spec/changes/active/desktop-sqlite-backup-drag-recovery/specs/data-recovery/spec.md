# Data Recovery Delta

## `FR-SQLDR-001`: Accept generated SQLite backups at the backup drop target

On desktop, dropping a PromptHub-generated SQLite database or database backup
must inspect it as a recovery candidate instead of parsing it as an exported
archive. A valid candidate must open the existing recovery preview and require
explicit confirmation before restore.

## `FR-SQLDR-002`: Discover all generated standalone database backups

Manual recovery scans must include the active database basename and generated
`backup`, `backup-before`, `pre-recovery`, `integrity-backup`, and
`legacy-conflict` variants, including historical variants without a final
`.db` extension.

## `FR-SQLDR-003`: Reject unsafe or ineffective candidates

Symlinks, corrupt or unrecognized SQLite files, files smaller than a SQLite
page, and databases containing no recoverable PromptHub business records must
not be offered for restore. A valid database that is temporarily locked must
remain discoverable so the user can inspect any durable files beside it.

## `FR-SQLDR-004`: Honor durable data in manually selected directories

A manual historical scan must surface the selected directory when it contains
durable PromptHub data under `data/` or `config/`, including Rules, MCP,
Plugins, media, and future business-data directories, even if SQLite is absent,
empty, or temporarily locked. Cache, logs, backups, and symlink targets must
not make an otherwise empty directory recoverable.

## `FR-SQLDR-005`: Report and restore the complete candidate inventory

Recovery candidates must report every detected durable data class instead of
reducing the summary to Prompt, Folder, and Skill counts. Directory recovery
must merge the complete link-safe `data/` and `config/` trees without
overwriting current files. A locked SQLite preview must fall back to the
available file inventory rather than presenting the candidate as empty.

## `FR-SQLDR-006`: Make backup coverage explicit and independently selectable

The desktop file picker must route generated SQLite backups through the same
recovery preview as drag-and-drop. Selective export must provide independent
MCP and Plugin scopes. Full-backup copy and import preview must enumerate MCP,
Plugins, Rules, media, settings, and other included data instead of implying
that only Skills are preserved.
