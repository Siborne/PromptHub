# Legacy Upgrade Recovery Audit Proposal

## Phase And Status

- Phase: analyze
- Status: test-design-ready
- Primary requirements: `FR-LEGACYREC-001` through `FR-LEGACYREC-011`
- Related issues: #89, #97, #98
- Related migration mechanism change: `database-migration-safety`
- Current delivery cut: historical fixture audit and only the remediation that a
  fixture proves necessary
- Exit condition: every issue has a tagged, sanitized reproduction result; any
  reproduced current defect has an atomic fix, restart verification, and a
  rollback regression test.

## Why

The reports span the 0.4.7 through 0.5.3 transition and describe three distinct
risks: a Windows runtime-path change, an incompatible restore path, and missing
intermediate Prompt versions. They must not be collapsed into a generic
"migration bug" or declared fixed because newer recovery code exists.

Repository history provides credible evidence for the path transition in #89,
but #97 and #98 still need executable tagged fixtures. The current code already
contains candidate discovery, upgrade snapshots, staged restore safeguards, and
an unrestricted Prompt-version query. The first implementation step is therefore
to test those existing boundaries, not to add a second recovery framework.

## Scope

- Build synthetic fixtures from the v0.4.7, v0.4.8, v0.5.1, and v0.5.2
  schemas, path rules, and backup formats.
- Reproduce the Windows install-directory to roaming-directory transition from
  #89 without writing into either source during discovery.
- Verify v0.5.1 portable JSON backup import and v0.5.2 upgrade-snapshot restore
  as separate artifact types for #97.
- Verify that a Prompt with at least four ordered versions retains its oldest,
  intermediate, and latest records through import, migration, restart, UI
  loading, and rollback for #98.
- Preserve the file-owned `config/ai-models.json` inventory when renderer
  persistence migrates default-empty provider/model arrays. For roots already
  affected by the 0.6.0 beta migration, repair only the unambiguous
  empty-model/dangling-route state from a bounded managed upgrade safety point.
- Preserve PromptHub-owned Agent Skill symlink distributions when canonical
  migration replaces legacy slug-based managed repositories with stable
  id-based workspaces. Rebind only links proven by both the platform activation
  record and the exact legacy PromptHub target layout.
- Repair an older writer's mixed Prompt directory when validated canonical
  bundle directories remain beside the complete legacy Markdown workspace;
  reuse only hash-verified same-Prompt media objects when the legacy file name
  is no longer present, and modify neither source before publication succeeds.
- Keep recovery-source browsing as an explicit Settings action. Normal startup
  performs versioned migration, validation, and deterministic self-heal without
  scanning candidates or opening a recovery-source picker.
- Reuse current database, recovery, IPC, and renderer boundaries; change
  production behavior only where a fixture exposes a current failure.

## Deferred And Non-Goals

- Mobile distribution, Windows signing, cloud collaboration, marketplace
  protocols, and remote Git transports are outside this delivery cut.
- This historical-fixture change does not own the shared migration engine. Any
  current mechanism work belongs to `database-migration-safety`; a whole-home
  scan or automatic selection of a recovery source remains unauthorized.
- Manual deletion, blind database copying, or treating backup files as ordinary
  Prompt version history is out of scope.

## Risks And Rollback

- Selecting the wrong source can overwrite newer data. Discovery and preview
  remain read-only; the active runtime path changes only after explicit user
  confirmation and a successful staged validation.
- Legacy databases may be corrupt, locked, partially migrated, or contain
  symlinks. Invalid candidates are rejected without falling back to destructive
  copying.
- Every applied recovery uses the existing pre-recovery/insurance snapshot and
  atomic publish boundary. A failed attempt leaves the active data unchanged and
  cleans task-owned staging resources.
- AI model repair never scans outside the up to five retained managed upgrade
  safety points,
  never selects a candidate that lacks any currently routed model id, and
  republishes recovered credentials only through the encrypted renderer vault.
- Skill link repair never adopts an arbitrary external dangling link, never
  matches by display name alone, and restores the original link if staged
  replacement cannot complete.
- Fixtures are synthetic and contain no user credentials, personal paths, or
  production data.

## Related Records

- `evidence.md`
- `spec/knowledge/behavior/data-recovery.md`
- `spec/knowledge/behavior/desktop.md`
