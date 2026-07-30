# Proposal

## Problem

A desktop Skill Store install can reach the database finalization step while the
SQLite freelist header is inconsistent. SQLite then reports `database disk
image is malformed`; the install rollback cannot delete its pending row and the
renderer only sees `ROLLBACK_INCOMPLETE`.

## Scope

- Detect database integrity problems before schema migration or application
  writes begin.
- Automatically repair only the narrow, verified SQLite freelist-count
  inconsistency by creating a byte-for-byte backup and running `VACUUM` while
  the database client lease is exclusively held.
- Refuse startup for every other integrity failure instead of guessing at a
  repair.
- Keep Skill package recovery responsible for cleaning an interrupted pending
  install after the repaired database is reopened.

## Risks And Rollback

`VACUUM` rewrites the database file, so a timestamped pre-repair backup is
mandatory. If repair or the post-repair check fails, initialization stops and
the backup remains available. No automatic table-level salvage is attempted.
