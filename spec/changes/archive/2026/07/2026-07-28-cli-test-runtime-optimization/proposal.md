# CLI Test Runtime Optimization

## Why

The CLI suite takes about 85 seconds for 114 tests. Most database-backed tests
create a fresh user-data root, so the same SQLite schema and migrations are
rebuilt roughly once per test even though those tests exercise CLI behavior,
not fresh-install migration behavior.

## Scope

- Build one empty, fully migrated SQLite template for the CLI test run.
- Copy that closed template into ordinary isolated test roots.
- Preserve explicit unseeded coverage for fresh database creation.
- Keep test files serial because they mutate process-global runtime paths,
  database handles, `cwd`, and `HOME`.
- Add a performance guard for the full CLI suite.

## Non-Goals

- Production database initialization behavior does not change.
- Migration and database-concurrency tests are not replaced by the template.
- Tests are not removed, merged, or weakened to improve timing.

## Risk And Rollback

A seeded fixture could accidentally hide fresh-install behavior. The harness
therefore requires an explicit seed and the dedicated database-creation test
opts out. Reverting the global setup and helper copy restores the previous
behavior without product data impact.
