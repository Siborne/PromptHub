# Implementation

## Status

Implemented and verified locally. Release state remains separate.

## Implemented Behavior

- The desktop backup drop target distinguishes PromptHub export archives from
  generated SQLite database backups.
- Dropped SQLite backups are resolved through Electron's trusted file-path
  bridge, inspected by the main process, and opened in `DataRecoveryDialog` for
  item preview and explicit confirmation.
- The rollback section's refresh action now refreshes manifest snapshots and
  runs the unified recovery scan, so standalone database backups are surfaced
  through the same preview flow.
- Standalone scanning includes `backup`, `backup-before`, `pre-recovery`,
  `integrity-backup`, and `legacy-conflict` variants with or without a final
  `.db` extension.
- Recovery validates a regular non-symlink SQLite file with recoverable
  PromptHub business records before replacing the active database. The existing
  pre-recovery copy and restart behavior remains authoritative.
- Archive imports retain their existing merge semantics.
- Manual historical directories are now recoverable when they contain MCP,
  Rules, Plugins, config, media, or future durable `data/` files without any
  Prompt or Skill rows.
- Recovery candidates expose category counts and file previews. Temporarily
  locked SQLite databases remain discoverable, and preview falls back to the
  link-safe durable file inventory.
- Directory restore merges the complete `data/` and `config/` trees without
  replacing files already present in the current location.
- SQLite recovery is available through both drag-and-drop and the file picker.
  Selective exports now model Skill, MCP, and Plugin independently; full backup
  and import confirmation enumerate the actual Rules, MCP, Plugin, media, and
  configuration inventory.

## Verification

- Red phase reproduced all three reported gaps: generated backup filenames were
  omitted, extensionless backups were treated as directories, and SQLite drops
  never called recovery scanning.
- Focused recovery, Data settings, recovery dialog, and database backup suites:
  7 files, 113 tests passed.
- `pnpm --filter @prompthub/desktop typecheck`: passed.
- `pnpm --filter @prompthub/desktop lint`: passed.
- `pnpm --filter @prompthub/desktop build`: passed with existing chunk warnings.
- `pnpm --filter @prompthub/desktop dev`: Vite, main, preload, Electron, and
  the real local `data/prompthub.db` initialized successfully. In the running
  app, Backup & Restore -> Refresh opened the recovery preview with 122 real
  candidates; generated `data/prompthub.db.backup-*` files displayed Prompt,
  Folder, and Skill counts. No recovery was executed.
- `git diff --check`: passed.
- Follow-up focused suites cover recovery detection/preview/merge, Data settings,
  backup orchestration, and import/export: 8 files, 131 tests passed.
- Follow-up `pnpm --dir apps/desktop typecheck`: passed.
- Follow-up `pnpm --dir apps/desktop lint`: passed.
- Follow-up `pnpm --dir apps/desktop build`: passed with the existing chunk-size
  and mixed fflate import warnings.
- Real Electron verification opened Data Sync -> Backup & Restore and confirmed
  independent MCP and Plugin controls plus the complete full-backup description.
  Data Sync -> Historical Data Recovery scanned 129 real local candidates; the
  selected upgrade snapshot displayed 1 MCP file, 29 Rule files, 61 Plugin
  files, 4 config files, 21 media files, and 136 other data files. No restore or
  export action was executed.
