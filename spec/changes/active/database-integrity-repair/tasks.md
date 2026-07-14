# Tasks

- [x] `T-DBIR-001`: Add a lease-bound pre-write quick-check gate.
- [x] `T-DBIR-002`: Back up and repair verified freelist-only mismatches, then recheck.
- [x] `T-DBIR-003`: Fail closed for unsupported corruption diagnostics.
- [x] `TEST-DBIR-001`: Corrupt a real SQLite freelist header and prove startup repairs it without losing rows.
- [x] `TEST-DBIR-002`: Prove unsupported quick-check failures are not automatically repaired.
- [x] `T-DBIR-005`: Recover all previous-process Skill package journals at IPC startup while retaining leased cleanup for runtime calls.
- [x] `TEST-DBIR-003`: Prove startup mode cleans a fresh pending install and that default cleanup still preserves fresh live work.
- [x] `T-DBIR-004`: Run database, Skill lifecycle, lint, type, and build verification and sync stable docs.
