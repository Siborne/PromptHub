# Design

## DES-WINSTART-001 Write-Capable Flush Handles

Windows implements Node file `fsync` through `FlushFileBuffers`, which requires
a handle opened with write access. Existing files that are flushed after a
copy or SQLite `VACUUM INTO` will be reopened with `r+`. Newly staged JSON will
be created through a write-capable descriptor and written and flushed through
that same descriptor.

Hash-only and read-only verification descriptors remain `r`; they are never
passed to `fsync`.

## DES-WINSTART-002 Packaged Upgrade Smoke

Add a bounded Node script invoked only by the Windows x64 release matrix after
electron-builder produces `dist/win-unpacked/PromptHub.exe`.

The script must itself load under Node's `--experimental-strip-types` runner.
It may import runtime JavaScript dependencies, but it must not import package
TypeScript source that requires transformation beyond type stripping.

The script will:

1. Create a task-owned temporary AppData root below `RUNNER_TEMP`.
2. Seed a valid legacy SQLite database and a `0.5.9` last-run marker.
3. Launch the unpacked packaged executable without the E2E storage bypass and
   request the temporary AppData root through a release-smoke-only environment
   seam.
4. Parse `logs/startup.log` until it observes `startup:upgrade_backup` with
   `snapshot-created` and `startup:window_ready`.
5. Fail on early exit, explicit startup failure, or timeout.
6. Terminate only the launched process tree and remove the temporary profile.

Electron resolves Windows `appData` through the operating-system Known Folder
API, so changing only the child process `APPDATA` environment variable is not a
reliable isolation mechanism. The packaged main process may honor the seam only
when all of these are true: the binary is packaged, the platform is Windows,
`CI=true`, and the requested root is a strict descendant of `RUNNER_TEMP`.
Invalid or out-of-root requests fail closed. After setting Electron's
`appData` path, startup continues through the normal data-path resolver,
upgrade backup, migration, database initialization, and renderer load.

On failure the script reports bounded child output, the isolated profile tree,
and any startup logs found below that root before cleanup.

Windows arm64 remains packaging-only because GitHub's Windows runner is x64 and
cannot provide native arm64 execution evidence.

## DES-WINSTART-003 Bounded Resource Ownership

The smoke uses one child process, a fixed 60-second timeout, 250 ms polling,
bounded captured output, and a `finally` cleanup path. It never changes system
proxy, runner-global PromptHub data, or existing processes.

## Verification

- `TEST-WINSTART-001`: Focused Vitest regressions reject read-only fsync handles
  across canonical staging, SQLite images, and raw evidence.
- `TEST-WINSTART-002`: Release workflow tests require the packaged Windows x64
  smoke step and prove the script reaches its platform guard under Node
  strip-types without unsupported TypeScript syntax.
- `TEST-WINSTART-004`: Unit tests prove the AppData override is unavailable to
  normal/dev launches and rejects paths outside the runner-owned temporary
  root.
- `TEST-WINSTART-005`: Desktop skill reconciliation proves a committed marker
  remains valid when Windows rejects best-effort directory fsync after rename.
- `TEST-WINSTART-003`: GitHub Actions manual release workflow passes the Windows
  x64 packaged upgrade smoke and the full platform matrix before tagging or
  publication.

## Complexity

The unit checks add constant work around existing file operations. The release
smoke creates one small database and scans a bounded startup log; time and
memory are `O(n)` in the bounded log size, with no network requests required.
