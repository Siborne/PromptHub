# Database Lock Recovery Delta

## Requirements

### FR-WEBLOCK-001

When the self-hosted Web server starts with a stale ownerless legacy
`<DATA_ROOT>/data/prompthub.db.lock` directory, it must recover the lock and
continue database initialization.

### FR-WEBLOCK-002

When a registered database client is still alive, Web startup must preserve the
lock and must not remove it as part of legacy recovery.

### FR-WEBLOCK-003

The self-hosted Web deployment must keep one server process per SQLite data
root; this change does not provide shared-volume multi-replica support.

## Traceability

| Requirement | Design | Verification | Task |
| --- | --- | --- | --- |
| FR-WEBLOCK-001 | DES-WEBLOCK-001 | TEST-WEBLOCK-001 | T-WEBLOCK-001 |
| FR-WEBLOCK-002 | DES-WEBLOCK-002 | TEST-WEBLOCK-002 | T-WEBLOCK-002 |
| FR-WEBLOCK-003 | DES-WEBLOCK-003 | TEST-WEBLOCK-003 | T-WEBLOCK-003 |
