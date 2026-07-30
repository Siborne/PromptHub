# Design

## DES-CLI-TEST-001: One closed database template

Vitest global setup initializes an empty database once, closes SQLite and its
lease, and publishes the template path through an environment variable. Test
roots copy the single database file into their own `data/` directory. Copying
is `O(database size)` per test but avoids repeated schema parsing and migration
execution; the template is small and bounded.

## DES-CLI-TEST-002: Explicit unseeded roots

`makeTempRoot()` accepts `seedDatabase: false`. The existing test for unified
fresh database creation uses this mode. Dedicated database concurrency tests
continue to construct their own fixtures.

## DES-CLI-TEST-003: Serial execution with a runtime budget

File parallelism remains disabled because CLI tests intentionally mutate
process globals. A measured four-fork experiment reduced wall time only from
85.32 to 73.62 seconds while increasing aggregate test time to 269.78 seconds,
so it is rejected. The optimized serial suite receives a generous CI budget
above the measured runtime to detect regressions without creating flaky timing
checks.

## Resource Lifecycle

Global setup owns the template directory and removes it during teardown.
Individual tests continue removing their isolated roots in existing hooks.
SQLite handles and lease files are closed before any template copy.
