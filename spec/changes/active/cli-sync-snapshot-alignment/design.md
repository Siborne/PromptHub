# Design

## Approach

Introduce a small core CLI workspace snapshot helper instead of expanding the legacy `packages/core/src/cli/run.ts` file.

## Boundaries

- `packages/core/src/cli/workspace-sync.ts` owns CLI workspace bundle parsing, export snapshot creation, and import restoration.
- `packages/core/src/cli/run.ts` remains responsible for argument parsing and output.
- Cloudflare sync keeps the same D1 table but stores the full normalized JSON payload and computes richer summary counts from the payload.
- Web client API types mirror the richer summary/count shape.

## Data Contract

CLI exports `kind = "prompthub-cli-workspace"`, `version = 2`, and a `payload` shaped like `SyncSnapshot`.

Supported import shapes:

- v2 CLI workspace bundle with `payload`
- raw `SyncSnapshot`
- legacy v1 CLI prompt-only bundle

## Import Semantics

`--force-clear` clears the core database rows for prompts, folders, prompt versions, skills, and skill versions before restore. Rules, MCP, and Plugin file-backed state are overwritten only when the imported payload includes those fields.

## Limitations

Desktop renderer-only store-source localStorage cannot be read by standalone CLI. CLI preserves `storeSources` if present in an imported bundle but does not synthesize it during export unless a future shared persisted store is introduced.

## Verification

- CLI command-level tests cover v2 export and import of prompts, rules, skills, MCP, and plugins.
- Cloudflare tests cover full snapshot field preservation and richer manifest counts.
- Typecheck validates web client summary type changes.
