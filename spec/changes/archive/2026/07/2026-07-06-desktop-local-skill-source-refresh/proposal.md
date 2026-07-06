# Proposal

## Why

Issue #129 reports three related regressions around local skill sources: updating a locally sourced skill fails, removing and reimporting a local source still shows stale content, and the source-detail sidebar import button does nothing.

Follow-up user feedback asks for local skill imports to support a linked mode. When a user imports a Skill from a local working directory, they may keep iterating in that original directory. A copied My Skills package becomes stale and makes upgrades harder, while a linked My Skills package should keep the original folder as the source of truth.

## Scope

- identify why local source content is not refreshed from disk during update / reimport flows
- fix local source update detection and install/update execution
- fix source-detail "Import to My Skills" interaction for local scanned skills
- add a My Skills local import mode that links to the original local source directory instead of copying it
- keep copy import as the default, detached snapshot behavior
- ensure linked My Skills records read, edit, and sync through the linked source directory
- ensure deleting a linked My Skills record does not delete the external source directory
- add regression tests that mirror the user workflow

## Risks

- local source updates share logic with registry/store updates, so changes may affect other store source types
- stale cached source entries can hide multiple bugs if not tested across remove/reload paths
- changing `local_repo_path` semantics to allow durable external source directories affects file-editor, sync-from-repo, and delete flows
- missing or moved linked source folders must fail visibly without silently replacing the user's source-of-truth choice with a managed copy

## Rollback

- revert local source resolution changes and keep the current scan/store behavior
- linked imports can be rolled back by removing the mode selector and returning scanned imports to copy-only `saveToRepo` materialization

## Impacted User Flows

- update a skill imported from a local folder source
- remove and reimport a local folder source after editing `SKILL.md`
- import a scanned local skill from the source detail sidebar
- import a local skill into My Skills as either a copied snapshot or a linked source
- edit a linked My Skills package and have the external source directory reflect the change
