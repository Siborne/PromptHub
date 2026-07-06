# Proposal

## Why

My Skills already shows source badges such as Claude Code Store, GitHub Import,
Agent import, and Local Import, but users cannot quickly filter the library by
those source groups.

## Scope

- Add a My Skills header source dropdown.
- Reuse the existing source badge derivation as the filter source of truth.
- Combine source filtering with existing All/Favorites/Distributed/Pending,
  search, tag, view mode, and pagination behavior.

## Non-Goals

- No new durable storage setting for the selected source filter.
- No database schema change.
- No new source taxonomy separate from existing badge logic.
