# Design

## DES-WEBLOCK-001: Reuse guarded database recovery

Pass `recoverUnregisteredLock: true` from the self-hosted Web database entry
point to the existing `@prompthub/db` initializer. The database package still
requires no live registered client, no unknown lease entry, and a normal lock
directory before removal.

## DES-WEBLOCK-002: Preserve active writers

Do not modify the shared lock algorithm. Its client lease scan remains the
source of truth for active PromptHub processes; a live lease prevents legacy
lock removal even when Web recovery is enabled.

## DES-WEBLOCK-003: Deployment boundary

Self-hosted Web is a single-process deployment for each mounted `DATA_ROOT`.
The Docker Compose examples continue to run one container and must not be
scaled against the same SQLite volume.

## Analyze

The implementation reuses an existing hook and does not change the database
schema, file layout, or ownership model. The failing user-visible startup path
is covered before changing production code by `TEST-WEBLOCK-001`.
