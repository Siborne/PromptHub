# Agent Management Maintenance CLI Designs

This file is a supporting design record within
`spec/changes/active/agent-management-workbench/`. It does not create a second
platform registry, executable inventory, or package-manager state store.

## `DES-AGENT-049`: Read-Only CLI Diagnostics

The first maintenance batch is intentionally read-only. It detects an
allowlisted Agent executable, runs only that platform's declared version
command, and returns a bounded public diagnostic. Install and update commands
remain unavailable until their separate plan/confirm/apply and rollback
contracts are implemented.

### Source Of Truth

- `packages/shared/constants/platforms.ts` owns each built-in platform's
  optional CLI descriptor: executable candidates, version arguments and
  evidence identifier.
- `packages/shared/constants/agent-platform-capabilities.ts` derives
  `maintenanceCli` from that descriptor. It must not maintain another platform
  id allowlist.
- The main process owns command resolution and execution. Renderer code can
  request a diagnostic by Agent id but cannot submit a command, arguments,
  environment variables or shell text.
- Custom Agents stay unsupported until a native file-picker-backed executable
  registration contract is designed. A renderer-provided arbitrary path is
  not an acceptable substitute.

### Detection Contract

For a declared built-in descriptor, the main process checks candidates in
registry order. Resolution uses at most 256 deduplicated PATH, package-manager
and standard executable directories, does not launch the candidate merely to
locate it, and canonicalizes the first executable file it can access.
Execution uses argument arrays without a shell, a 5-second timeout and a
64 KiB limit on each captured stream. The first successful version response
wins. The public result includes only:

- status: `installed`, `not-installed`, `unhealthy` or `unsupported`;
- the resolved executable path;
- one normalized, length-bounded version line;
- a coarse installation source inferred from the resolved path;
- a stable error code and check timestamp.

Raw stderr, thrown errors, environment values and command output beyond the
normalized version line never cross IPC. Timeout, oversized output and
non-zero exit are `unhealthy`; an unresolved executable is `not-installed`;
platforms without a descriptor are `unsupported`.

The service checks at most the small, fixed candidate list for one platform.
With `c` candidates, at most `p = 256` search directories, at most four Windows
extensions and bounded captured output `b`, lookup is `O(c * p)` on Unix or
`O(c * p * 4)` on Windows, and memory is `O(p + b)`. All terms except the
registry candidate count are hard bounded. There is no network request,
recursive filesystem scan, retry loop or persistent cache.

### CC Switch Reuse Boundary

PromptHub adapts the useful CC Switch v3.18.0 idea of checking the executable
that is actually first in the user's environment rather than assuming the
package-manager prefix is active. PromptHub does not copy CC Switch's Rust
command layer, Tauri IPC, database schema or screens. The implementation uses
PromptHub's canonical platform registry, Electron main-process boundary and
typed preload API.

### Verification

`TEST-AGENT-067` covers registry derivation, PATH and prefix-like resolved
locations, version normalization, candidate fallback, unsupported platforms,
missing executables, timeout/non-zero/oversized failures, redaction, IPC input
validation and the renderer diagnostic dialog in all seven locales.

`T-AGENT-103` delivers this read-only batch. It does not close
`T-AGENT-029` or `TEST-AGENT-016`, which still require explicit install/update
plans, confirmation, post-write verification and failure recovery.

### OpenClaw evidence expansion

OpenClaw joins the same read-only diagnostic contract through its official
global `-V` / `--version` flag. The canonical descriptor uses only
`openclaw --version`; it does not run onboarding, Gateway, update, repair,
plugin, Skill or session commands. Official installation and update
documentation also proves richer lifecycle commands, but PromptHub keeps those
mutating paths unavailable until `T-AGENT-029` defines a separate
plan/confirm/apply/verify/rollback workflow.

Evidence:

- <https://docs.openclaw.ai/cli>
- <https://docs.openclaw.ai/install>
- <https://docs.openclaw.ai/cli/update>

`TEST-AGENT-068` fixes the exact executable, argument and evidence declaration
and proves that the derived capability is `partial`, not a claim that
installation or updates are implemented. `T-AGENT-104` adds only this
evidence-backed descriptor and updates the current platform inventory.

## `DES-AGENT-059`: Confirmed OpenCode CLI Update

The first mutating maintenance slice is limited to OpenCode because its
official CLI contract documents both `opencode upgrade` and exact-version
recovery through `opencode upgrade v<previous-version>`. Install automation and
updates for other Agent CLIs remain disabled until their installation-source
and exact recovery contracts have equivalent evidence.

### Plan And Apply Boundary

- `packages/shared/constants/platforms.ts` remains the only command descriptor
  owner. OpenCode declares fixed update arguments, a fixed rollback target
  prefix and its official evidence id; renderer code cannot provide any of
  them.
- Planning reuses the read-only diagnostic, requires a healthy semantic
  version and creates a main-owned one-shot plan bound to the requesting
  renderer. The renderer receives a detached review copy containing the
  executable, fixed arguments, current version, detected install source and
  five-minute expiry.
- Main keeps at most 32 pending plans. It removes a plan before awaiting the
  command, so replay and concurrent apply cannot execute it twice. Apply
  re-diagnoses the executable and exact version; any change invalidates the
  plan before mutation.
- Execution never uses a shell, inherits no renderer-provided environment or
  argument, times out after 120 seconds and caps each command result at
  256 KiB. The UI requires a separate confirmation after showing the exact
  command.
- A successful command is followed by a fresh diagnostic. Verification
  failure or a partially mutating command failure attempts the captured exact
  rollback command and verifies both executable path and version. Failed
  recovery returns a stable manual-recovery code; raw output, errors and
  credentials never cross IPC.

Planning and applying inspect one fixed platform descriptor and perform a
constant number of bounded diagnostics/commands, so CPU and memory are
`O(1)` with respect to user data. Pending memory is bounded by 32 small plans.
There is no recursive scan, package inventory, retry loop or persistent
maintenance state.

### Evidence And Scope

Official OpenCode CLI evidence:

- <https://opencode.ai/docs/cli/>

`TEST-AGENT-078` covers detached plan immutability, sender ownership, expiry,
capacity, replay/concurrency, changed preconditions, fixed arguments,
successful/no-change verification, exact rollback, rollback failure,
redaction, IPC/preload, UI confirmation and all seven locales.
`T-AGENT-114` delivers only OpenCode update. It advances but does not close
`T-AGENT-029` or aggregate `TEST-AGENT-016`: installation and all other CLI
update lifecycles remain explicitly unavailable.

## `DES-AGENT-063`: Confirmed npm-managed Codex CLI Update

Codex has several official installation channels, but they do not share one
exact recovery command. This slice therefore supports only an active
npm-managed Codex executable whose canonical path is classified as `npm` or
`node-version-manager`. Homebrew casks, standalone installer releases, direct
downloads, system packages, pnpm, user-local and unknown paths remain
diagnostic-only.

### Canonical command ownership

`packages/shared/constants/platforms.ts` remains the sole command descriptor
owner. The Codex descriptor contains:

- fixed `npm` executable candidates;
- accepted active installation-source classes;
- `install -g @openai/codex@latest` update arguments;
- `install -g @openai/codex@<captured-version>` rollback construction;
- official Codex and npm evidence identifiers.

The renderer supplies only the Agent id and later the opaque plan id. It
cannot supply a package name, version, executable, manager, argument,
environment value, registry URL or shell text.

### Plan, verification and recovery

Planning diagnoses the active `codex`, requires a semantic version, rejects an
unsupported source, resolves `npm` independently, and captures both canonical
executables plus immutable update and rollback arguments in a main-owned
five-minute plan. The public review shows the exact package-manager command,
current version and diagnosed source.

Apply consumes the one-shot plan before awaiting work. It re-diagnoses the
same active Codex executable and version, then runs the captured npm command
without a shell under the existing 120-second and 256 KiB limits. Success is
accepted only when the same active Codex path remains healthy and reports a
semantic version. A command failure that left the original path/version
unchanged returns a bounded failure without a needless rewrite. Any changed,
missing or unhealthy post-state attempts the captured exact-version npm
rollback and verifies the original path and version. Failure returns only a
stable public code.

This uses a constant number of bounded command resolutions and executions, so
CPU and memory are `O(1)` with respect to user data. It adds no recursive
package scan, network preflight, retry loop, persistent updater state, elevated
privilege request or renderer-visible command output. npm performs its own
network operation only after explicit confirmation.

### Evidence and verification

Primary evidence:

- <https://github.com/openai/codex/blob/main/README.md>
- <https://docs.npmjs.com/cli/v11/commands/npm-install>

`TEST-AGENT-081` covers registry ownership, accepted and rejected installation
sources, missing npm, detached review plans, fixed arguments, precondition
changes, same-path verification, exact rollback, partial command failures,
redaction, replay and renderer ownership. `T-AGENT-118` implements only this
Codex npm update path. It advances `TEST-AGENT-016` and `T-AGENT-029`; Codex
install, Homebrew/standalone updates and other Agent lifecycle commands remain
disabled until an equally exact recovery contract exists.

## `DES-AGENT-065`: Confirmed npm-managed Qwen Code CLI Update

Qwen Code reuses the same main-owned lifecycle engine as Codex, but keeps its
own registry descriptor and package identity. Only an active executable
classified as `npm` or `node-version-manager` is eligible. The fixed update is
`npm install -g @qwen-code/qwen-code@latest`; rollback replaces the dist-tag
with the captured semantic version.

Planning resolves `qwen` and `npm` independently, returns a detached five-minute
review plan and performs no mutation. Apply consumes the plan once, rechecks the
same executable and version, runs without a shell under the existing 120-second
and 256 KiB limits, then verifies the same executable. A failed command that
left the original state intact returns a bounded failure; a changed, missing or
unhealthy state runs the captured exact-version npm command and verifies
restoration. Standalone scripts, Homebrew, source builds, system paths and
unknown locations remain diagnostic-only because they do not share this
recovery contract.

The operation performs a constant number of bounded command resolutions and
executions, so CPU and memory are `O(1)` in user data. It adds no persistent
updater state, recursive scan, network preflight, retry loop or renderer-owned
arguments. PromptHub adapts the public package-manager workflow and does not
copy or vendor Qwen Code source.

Primary evidence:

- <https://qwenlm.github.io/qwen-code-docs/en/users/support/troubleshooting/>
- <https://qwenlm.github.io/qwen-code-docs/en/users/quickstart/>
- <https://docs.npmjs.com/cli/v11/commands/npm-install>

`TEST-AGENT-083` covers registry ownership, eligible and ineligible sources,
missing npm, immutable review, precondition changes, same-path verification,
partial failure and exact rollback. `T-AGENT-120` implements only this npm
update path; Qwen installation and non-npm updates remain unavailable.
