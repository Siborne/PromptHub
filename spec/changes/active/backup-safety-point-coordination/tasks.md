# Backup Safety Point Coordination Tasks

- [x] `T-BACKUPCOORD-001` Add failing tests for exact transition reuse, stale
      transition refusal, install target propagation, layout migration reuse,
      payload hygiene, and aggregate protected-minimum retention
      (`FR-BACKUPCOORD-001..004`, `TEST-BACKUPCOORD-001..006`).
- [x] `T-BACKUPCOORD-002` Implement upgrade transition lookup and updater target
      propagation without changing manual snapshot semantics.
- [x] `T-BACKUPCOORD-003` Reuse startup and marker-referenced points in layout
      migration, falling back to a new point when validation fails.
- [x] `T-BACKUPCOORD-004` Implement bounded aggregate managed-backup planning and
      startup cleanup without touching invalid or unowned directories.
- [x] `T-BACKUPCOORD-005` Exclude transient standalone DB copies from new
      canonical whole-root upgrade snapshots.
- [x] `T-BACKUPCOORD-006` Run focused behavior, branch, type, lint, format,
      file-size, spec traceability, build, isolated real-filesystem checks, and
      a live-root dry run; record measured disk outcomes without deleting the
      live user backups.
