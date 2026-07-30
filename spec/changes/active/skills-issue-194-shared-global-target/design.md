# Design

<!-- traceability: enforced -->

## Product And Ownership Boundary

`SKILL_PLATFORMS` is the canonical Agent platform registry. It drives Agent
Management, platform detection, root configuration, Rules/MCP/Plugin
derivation, and Agent counts. Adding `.agents/skills` as a pseudo-platform
would falsely create an Agent with no executable, root, model, Rule, MCP, or
session identity.

The new object is a distribution target consumed by multiple Agents. Shared
target definition belongs in `packages/shared`; lifecycle policy belongs in
`packages/core`; Desktop main/IPC and CLI are adapters; renderer state owns only
selection and confirmation.

## `DES-SKILL194-001`: Shared target registry

Define a target union without changing `SkillPlatform`:

```text
SkillDistributionTarget =
  | { kind: "platform"; platformId; ...derived platform fields }
  | { kind: "shared"; id; pathTemplate; maturity; evidenceKey }
```

The first shared target is:

```text
id: agent-skills-global
kind: shared
maturity: experimental
default: <home>/.agents/skills
```

Services that only manage Agent platforms continue to consume
`SKILL_PLATFORMS`. Skill distribution surfaces consume the combined target
projection. Platform ordering preferences do not contain the shared target;
the UI renders it in an experimental/shared section.

CLI accepts the stable target id through the same Core projection. It does not
pretend the target is an installed Agent.

## `DES-SKILL194-002`: Path and settings contract

Resolve the default with `os.homedir()` and `path.join(home, ".agents",
"skills")`; do not expand `~` in mutating code. The optional override is stored
as a new settings field keyed by shared target id, separate from
`builtinAgentOverrides`.

Validation requires:

- absolute normalized path;
- no null/control characters;
- not a filesystem root or the user home itself;
- target Skill path remains inside the resolved target root;
- realpath containment checks for existing parents and symlinks;
- path comparison uses platform-aware canonicalization.

The settings JSON change is optional/defaulted and requires no SQLite schema
migration. Import/backup follows the existing settings contract; receipts are
device-local operational state and are not copied as user content.

## `DES-SKILL194-003`: Ownership receipt store

Store one atomic receipt per target/Skill under:

```text
<userData>/data/skill-distributions/receipts/
  agent-skills-global/<encoded-skill-id>.json
```

Receipt version 1 contains:

- target id and normalized target root;
- Skill id/name and stable source identity;
- target package path;
- requested and effective mode;
- canonical source path for symlink mode;
- source and installed package fingerprints;
- created/updated timestamps.

Receipts are written with a same-directory temporary file plus rename only
after target verification succeeds. A receipt is trusted only when its target
id, Skill identity, root, target path, and current filesystem object all match.
Invalid or forged receipts fail closed.

Receipts are operational ownership evidence, not Skill content. Backup/restore
does not make a new device owner of old target paths.

## `DES-SKILL194-004`: Lifecycle state machine

Shared target status is one of:

- `not-installed`;
- `managed-clean`;
- `managed-modified`;
- `unmanaged-conflict`;
- `receipt-stale`;
- `missing`.

Install:

1. validate source, root, and target;
2. detect receipt/unmanaged conflict;
3. stage copy or create a temporary link;
4. publish target with the existing safe replacement rules;
5. verify mode and package fingerprint;
6. atomically publish the receipt.

Update requires `managed-clean`. A modified target returns its current
fingerprint for explicit review; approval is bound to that fingerprint so a
later mutation cannot reuse stale confirmation.

Uninstall requires matching ownership. Clean copy removes only the target
package directory. Clean symlink removes only the link. Modified targets are
preserved unless an explicit fingerprint-bound destructive confirmation is
provided. A missing target removes the stale receipt idempotently.

If symlink creation is unavailable, the existing platform policy may fall back
to copy, but the result and receipt must report `effectiveMode: copy` and a
localized reason.

## `DES-SKILL194-005`: Duplicate selection analysis

Before writes, resolve every selected target to:

```text
{ targetId, targetRoot, targetSkillPath, canonicalPathWhenExisting }
```

Exact canonical target paths collapse to one physical operation and one owner;
the result reports every logical target represented by that operation.

The compatibility evidence matrix may additionally mark
`discoversSharedGlobal: true` and record precedence. When a user selects both
the shared target and such an Agent's native target, PromptHub warns that the
Agent may load two copies even though the physical paths differ. This warning
requires confirmation but does not guess which copy wins.

For `t` selected targets, comparison uses a map keyed by canonical path,
yielding `O(t)` time and memory rather than pairwise `O(t^2)` comparison.

## `DES-SKILL194-006`: Compatibility evidence model

Maintain a reference fixture with these fields:

- Agent id and tested version;
- operating system;
- evidence type: `official-doc`, `source`, `runtime`;
- user-level and project-level discovery result;
- copy and symlink result;
- native/shared precedence and duplicate behavior;
- date, command/build, and evidence link;
- status: `verified`, `documented`, `unsupported`, or `unverified`.

Official documentation currently provides positive user-level evidence for
Gemini, Augment, Windsurf, and OpenCode:

- https://geminicli.com/docs/cli/using-agent-skills/
- https://docs.augmentcode.com/cli/skills
- https://docs.windsurf.com/zh/windsurf/cascade/skills
- https://opencode.ai/docs/skills

Documentation alone remains `documented`, not `verified`. The current Qwen
documentation lists native `~/.qwen/skills` and does not provide current
user-level `.agents/skills` evidence:

- https://qwenlm.github.io/qwen-code-docs/en/users/features/skills/

The existing stable Agent reference currently states Qwen compatibility; that
discrepancy must be corrected during convergence unless runtime evidence proves
it. Claude, Cursor, Cline, and other platforms remain unverified until
official/source evidence plus runtime tests exist.

## Test-First Design

Implementation begins with tests proving a pseudo-platform is absent and a
shared target can be projected independently. Filesystem lifecycle tests then
run red against the missing target/receipt service.

Required methods:

- black-box Desktop and CLI distribution behavior;
- white-box state-machine branches and approval guards;
- boundary/security paths, symlinks, forged receipts, traversal, Unicode, and
  duplicate identity;
- real filesystem copy/symlink/update/uninstall;
- failure/rollback at staging, publish, verification, and receipt write;
- stress with large packages and many Skills, using bounded concurrency;
- runtime compatibility matrix on macOS, Windows, and Linux without touching
  developer-owned Agent data.

Runtime tests use isolated temporary homes or disposable CI users. They record
process IDs and terminate every Agent process they start.

## Performance And Capacity

- Target resolution: `O(t)` for selected targets.
- Package copy/fingerprint: `O(f + b)` for `f` files and `b` bytes within the
  existing Skill limits.
- Receipt lookup/write: `O(1)` per target/Skill receipt.
- Batch distribution uses the existing finite concurrency policy; no unbounded
  Agent fan-out or recursive target discovery is introduced.
- No long-lived cache is required. Compatibility evidence is repository data;
  filesystem status is refreshed on explicit status/distribution actions.

## Affected Areas

- Shared target/settings/receipt contracts
- Core Skill distribution target projection and lifecycle service
- Desktop main IPC/preload and Skill target picker/status UI
- CLI shared target selection and result output
- Settings persistence and backup filtering
- Stable Skill behavior and Agent compatibility reference
- No Agent registry entry and no SQLite schema migration

## Failure And Rollback

- External boundaries: source package read, target filesystem mutation, receipt
  publication.
- Partial failure: no receipt is published before verified target success;
  failed staging is removed; failed replacement preserves the previous managed
  target where the current atomic replacement primitive allows.
- Recovery: stale/missing receipts are diagnosed; unmanaged content is
  preserved; retry is idempotent.
- Rollback: disabling/removing the feature never deletes target content.

## Analyze Result

- Requirement links: current project-level `.agents/skills` support is
  separate and does not prove the user-level compatibility claim.
- Verification links: registry, path, lifecycle, ownership, duplicate,
  compatibility, and stress risks map to `TEST-SKILL194-*`.
- Blocking conflicts: none for an experimental target. The Qwen documentation
  discrepancy blocks only a `verified` compatibility label.
- Unresolved `[待确认]`: none. Compatibility rows remain evidence-gated tasks,
  not assumed product decisions.

## Traceability

| Requirement        | Design                                 | Verification                             | Task                               |
| ------------------ | -------------------------------------- | ---------------------------------------- | ---------------------------------- |
| `FR-SKILL194-001`  | `DES-SKILL194-001`                     | `TEST-SKILL194-001`                      | `T-SKILL194-001`, `T-SKILL194-002` |
| `FR-SKILL194-002`  | `DES-SKILL194-002`                     | `TEST-SKILL194-002`                      | `T-SKILL194-003`                   |
| `FR-SKILL194-003`  | `DES-SKILL194-003`, `DES-SKILL194-004` | `TEST-SKILL194-003`                      | `T-SKILL194-004`, `T-SKILL194-005` |
| `FR-SKILL194-004`  | `DES-SKILL194-003`, `DES-SKILL194-004` | `TEST-SKILL194-004`                      | `T-SKILL194-004`, `T-SKILL194-005` |
| `FR-SKILL194-005`  | `DES-SKILL194-005`                     | `TEST-SKILL194-005`                      | `T-SKILL194-006`                   |
| `FR-SKILL194-006`  | `DES-SKILL194-006`                     | `TEST-SKILL194-006`                      | `T-SKILL194-007`                   |
| `NFR-SKILL194-001` | `DES-SKILL194-003`, `DES-SKILL194-004` | `TEST-SKILL194-004`, `TEST-SKILL194-007` | `T-SKILL194-008`                   |
