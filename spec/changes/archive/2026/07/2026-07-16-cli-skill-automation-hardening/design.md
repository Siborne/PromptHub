# Design

## `DES-CR-001`: Legacy command classification

`apps/desktop/src/main/services/cli-installer.ts` resolves command paths separately from version execution. A small classifier reads only bounded regular files and recognizes the retired `PromptHub.app ... --cli` wrapper. Recognized wrappers are never executed. A successful npm/pnpm install removes the exact recognized file afterward; failure leaves it untouched. Direct `--cli` invocation is intercepted at the first `app.whenReady()` branch and exits before updater registration, database initialization, migrations, or window creation.

## `DES-CR-002`: Explicit database doctor

`packages/db` owns a typed lock inspection/recovery primitive built on the existing lease scan. `packages/core` exposes it through a `doctor` CLI route before database initialization. Recovery remains opt-in and refuses live/unknown clients and unsafe lock path types, preserving the stable mixed-version rule.

## `DES-SP-001`: Shared package matcher

`packages/shared` owns the pure built-in/custom matcher and uses the existing `ignore@7.0.5` MIT package for Gitignore-compatible custom rules. Core filesystem orchestration loads at most the root `.prompthubignore`, then passes the matcher through inventory and copy operations. The same filtered inventory feeds fingerprinting, snapshots, and secret scanning; `SKILL.md` is protected from custom exclusion. GitHub sources clone into a unique temporary checkout, select one package, scan it, and copy only the filtered package to the final managed path.

## `DES-SP-002`: Redacted deterministic secret guard

A pure shared scanner accepts normalized text entries and returns redacted findings. CLI filesystem orchestration throws a typed package-policy error before copy, snapshot, and distribution side effects. High-confidence token/key/password patterns block; placeholder forms do not. Findings never contain matched content. The traversal fails closed above 500 filtered entries, 2 MiB per text file, or 16 MiB cumulative text and caps diagnostics at 100 findings.

## `DES-CC-001`: Output policy in CLI context

Global parsing removes verbosity flags before resource routing and stores `summary`, `full`, or `quiet` in `CliContext`. `emitSuccess` suppresses quiet success. Heavy Skill handlers supply explicit summary payloads; explicit read/export handlers keep their command-specific result. Summary file counts read an existing package directly and never materialize or mutate a database-only Skill. Contradictory flags return `USAGE_ERROR`.

## `DES-CC-002`: Additive command aliases

Preferred intent names route to the existing implementation branches. Help and examples lead with the new names while documenting compatible legacy aliases. No stored data or command is removed.

## `DES-ST-001`: Renderer-derived topology

A focused `SkillAssetTopology` component derives source mode from existing Skill metadata and accepts the platform status detail map already loaded by `useSkillPlatform`. It owns only presentation; filesystem truth remains in main-process status APIs. The existing single-source card is replaced rather than duplicated.

## Failure And Rollback

- Legacy wrapper cleanup occurs after successful package-manager exit and ignores unrelated files.
- Database doctor performs no DB initialization; refused recovery has no filesystem mutation beyond pruning provably stale regular lease files.
- Managed copy writes to a temporary sibling and swaps only after policy validation, avoiding deletion of the existing package before copy succeeds.
- Secret errors use stable codes and redacted metadata.
- UI topology has no persistence side effects.

## Complexity And Capacity

- Legacy wrapper classification performs one `lstat` and at most one 4 KiB read; version probes time out after 3 seconds and package-manager installs after 120 seconds.
- Lock doctor work is `O(L)` in lease-directory entries with no SQLite open; recovery performs one bounded rescan and filesystem cleanup.
- Ignore matching and package traversal are `O(E * R)` for `E <= 500` filtered entries and `R` root ignore rules. Secret scanning is `O(B)` for at most 16 MiB of decoded text, using sequential 64 KiB reads and closing every file handle.
- Output summaries are `O(E)` only when an existing package directory is available; database-only summaries are `O(1)` and do not create files.
- Topology rendering is `O(P)` in the existing platform status map and adds no polling, network request, or durable state.

## Analyze Result

- Requirement links: complete across four domain specs.
- Verification links: `TEST-CR-*`, `TEST-SP-*`, `TEST-CC-*`, `TEST-ST-*`.
- Blocking conflicts: none. Stable database concurrency explicitly permits only opt-in recovery for CLI, which this design preserves.
- Existing active changes: no objective conflict; they remain review-pending records for earlier completeness/install/safety work.
- Unresolved `[待确认]`: none. The user approved the recommended guarded doctor, additive aliases, bounded output, unified package policy, and topology direction.

## Traceability

| Requirement | Design | Verification | Task |
| --- | --- | --- | --- |
| `FR-CR-001` | `DES-CR-001` | `TEST-CR-001` | `T-CR-001` |
| `FR-CR-002` | `DES-CR-002` | `TEST-CR-002` | `T-CR-002` |
| `FR-SP-001` | `DES-SP-001` | `TEST-SP-001`, `TEST-SP-002` | `T-SP-001` |
| `FR-SP-002` | `DES-SP-002` | `TEST-SP-003` | `T-SP-002` |
| `FR-CC-001` | `DES-CC-001` | `TEST-CC-001` | `T-CC-001` |
| `FR-CC-002` | `DES-CC-002` | `TEST-CC-002` | `T-CC-002` |
| `FR-ST-001` | `DES-ST-001` | `TEST-ST-001`, `TEST-ST-002` | `T-ST-001` |
