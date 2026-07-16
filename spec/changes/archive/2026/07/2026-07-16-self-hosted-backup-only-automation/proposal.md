# Self-Hosted Backup-Only Automation

## Why

The desktop currently presents self-hosted PromptHub Web as a backup target,
but its automatic behavior is actually destructive sync orchestration:

- interval runs import the desktop snapshot into the live Web workspace;
- startup runs pull the Web workspace and replace local desktop data;
- the automatic path has no exact desktop/Web release compatibility gate;
- a successful remote write is not retained as an independent recovery point.

This conflicts with the requested safety model: users must be able to keep
automatic cloud backups without enabling bidirectional sync or automatic local
replacement.

## Intended outcome

- Self-hosted automatic activity is upload-only backup, never pull or merge.
- Desktop and Web versions must match exactly before any remote backup write.
- The Web server stores immutable, checksummed, per-user snapshots under its
  `backups/` data boundary without modifying the live workspace.
- Restore is explicit and creates a local safety snapshot before replacing data.
- Existing legacy sync routes remain available for old clients during the
  compatibility window, but the current desktop UI and scheduler do not call
  them.

## Scope

The remote snapshot includes Prompts, versions, folders, relations, output
formats, Rules, Skills and Skill package files, MCP/Plugin libraries and package
files, store sources, agent asset files, media, and non-secret settings.
Provider/API credentials remain excluded until encrypted remote backup is
designed; this change must not upload plaintext AI keys.

## Source-of-truth discrepancy

`spec/knowledge/behavior/sync.md` currently treats self-hosted Web as an
automatic sync provider. The implemented behavior also pulls on startup. This
change makes the requested product boundary explicit: self-hosted Web is an
automatic backup and explicit restore target; WebDAV/S3 sync semantics are not
changed here.

## Risks and rollback

- Older Web deployments do not expose the new backup route. The desktop reports
  them as incompatible and does not fall back to live sync.
- Exact version matching deliberately skips backups during staggered upgrades.
  The skip is recorded in automatic operation history.
- Reverting the change restores the old sync behavior but leaves snapshot files
  inert under `backups/`; no live Web rows are derived from those files.

## Traceability

| Requirement  | Design        | Verification   | Task        |
| ------------ | ------------- | -------------- | ----------- |
| `FR-SHB-001` | `DES-SHB-001` | `TEST-SHB-001` | `T-SHB-001` |
| `FR-SHB-002` | `DES-SHB-002` | `TEST-SHB-002` | `T-SHB-002` |
| `FR-SHB-003` | `DES-SHB-003` | `TEST-SHB-003` | `T-SHB-003` |
| `FR-SHB-004` | `DES-SHB-004` | `TEST-SHB-004` | `T-SHB-004` |
| `FR-SHB-005` | `DES-SHB-005` | `TEST-SHB-005` | `T-SHB-005` |
