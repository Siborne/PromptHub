# Active Change Lifecycle Audit

Audit date: 2026-08-18

The baseline contained 60 active change directories with 1,166 checked and 229
open task markers. The first pass over-weighted unchecked task markers and is
superseded by the stricter lifecycle correction below: an unchecked future task
does not prove that implementation is currently active.

## Archived As Locally Complete

The following eight records had completed tasks, implementation and verification
evidence, no remaining external gate, and no owned dirty implementation files:

- `cli-agent-management`
- `cli-feature-completeness`
- `cli-install-manual-fallback`
- `desktop-dev-server-loopback-isolation`
- `desktop-issue-179-configured-skill-targets`
- `local-resource-device-identity`
- `mobile-app-shell`
- `prompt-output-format-contribution`

Their archive destinations are
`spec/changes/archive/2026/08/2026-08-18-<change-key>/`.

## Implemented But Still Externally Gated

- `desktop-upgrade-snapshot-lock-recovery`: release gate remains.
- `pi-agent-separation`: publication gate remains.
- `release-0-6-0-version-alignment`: version publication gate remains.
- `self-hosted-skill-sync-reliability`: next-version assignment/publication remains.
- `windows-packaged-upgrade-startup-gate`: replacement-publication decision remains.

These records stay active even though their current implementation task markers
are checked.

## Needs Explicit Convergence

- `rules-managed-copies`: the implementation record still names unfinished UI
  copy and test work. An explicit open convergence task was added, so the record
  remains active.

## Incomplete Records

The following 46 records retain open task markers and remain active. Counts are
`checked/open` at the audit baseline.

| Change                                           |  Tasks |
| ------------------------------------------------ | -----: |
| `agent-management-workbench`                     | 359/32 |
| `agent-provider-protocol-bridge`                 |    2/6 |
| `app-shell-left-rail`                            |   13/4 |
| `cloud-account-store-client`                     |   22/1 |
| `cloud-collaborative-prompt-sharing`             |    0/5 |
| `desktop-frontend-animation-system`              |   41/1 |
| `desktop-frontend-perf-tuneup`                   |   93/1 |
| `desktop-home-layout-controls`                   |    7/1 |
| `desktop-image-generation-workbench`             |   17/7 |
| `desktop-issue-192-copy-action-parity`           |    5/3 |
| `desktop-prompt-context-move`                    |    6/1 |
| `desktop-prompt-list-projection`                 |   7/18 |
| `desktop-renderer-ui-test-coverage`              |  158/1 |
| `desktop-skill-ui-size-performance`              |    7/1 |
| `desktop-update-dialog-polish`                   |    7/1 |
| `desktop-workspace-live-refresh`                 |    1/6 |
| `git-backup-transports`                          |    0/5 |
| `grok-build-platform-support`                    |    9/1 |
| `homepage-changelog-route-retirement`            |    1/5 |
| `legacy-upgrade-recovery-audit`                  |    5/8 |
| `macos-developer-id-signing`                     |   10/1 |
| `macos-timestamp-retry`                          |    1/1 |
| `marketplace-expansion`                          |    0/5 |
| `mcp-version-history-and-projection-safety`      |   2/10 |
| `mobile-prompt-persistence-hardening`            |   10/2 |
| `mobile-webdav-distribution`                     |    0/5 |
| `official-cloud-backup-and-saas-platform`        |   9/11 |
| `platform-workbench-prototype`                   |    0/6 |
| `plugin-issue-190-multi-native-manifests`        |    5/5 |
| `plugin-management`                              |  124/2 |
| `project-skill-management`                       |   24/1 |
| `prompt-workspace-completion`                    |    1/5 |
| `r2-direct-downloads`                            |   20/7 |
| `react-type-workspace-boundary`                  |    3/1 |
| `readme-screenshots-v0-5-6`                      |    0/8 |
| `republish-0-5-9-20260714`                       |    1/2 |
| `risk-aware-verification-harness`                |   20/6 |
| `rules-agent-source-matrix`                      |    2/6 |
| `rules-issue-193-missing-project-reconciliation` |    5/5 |
| `skill-uninstall-lifecycle`                      |   17/1 |
| `skills-issue-194-shared-global-target`          |    3/9 |
| `sync-issue-191-safety-report-contract`          |    3/5 |
| `update-channel-hardening`                       |   13/1 |
| `web-agent-service-parity`                       |   15/5 |
| `web-sync-contract-completion`                   |   10/6 |
| `windows-code-signing-and-reputation`            |    0/5 |

## Resulting Active Inventory

After the first eight archive moves and before this audit change was itself
closed, the active inventory contained 53 records. Closing the audit left 52
records, but calling all 52 genuinely active was incorrect.

## Lifecycle Correction

A second pass applied the actual WIP rule from
`spec/rules/change-management-rules.md`: active contains only work being
implemented, blocked, reviewed, converged, or held by a concrete current
release gate. It also cross-checked the issue roadmap instead of treating every
open checkbox as execution evidence.

Sixteen additional records moved out of active:

- eight accepted design/dependency backlogs already owned by
  `ISS-20260809-001`;
- one approved cloud architecture umbrella whose future phases require bounded
  child changes;
- one paused website change whose source tree is absent;
- six completed changes whose task lists contained stale, obsolete, optional,
  or PR-only unchecked items.

That correction left 36 active directories. A third evidence pass then checked
later commits, current source/test sizes, stable-doc decisions, issue routing,
and hosted release records instead of trusting stale task prose.

Nine more records moved out of active:

- `app-shell-left-rail`: all four old follow-ups were delivered by later Rules,
  Agent/MCP, and home-layout changes;
- `desktop-home-layout-controls`, `desktop-prompt-context-move`, and
  `desktop-update-dialog-polish`: implementation and verification were complete;
  their open documentation boxes were either synchronized or explicitly not
  required;
- `desktop-renderer-ui-test-coverage`: the coverage campaign completed; broad
  legacy test type escapes moved to quality issue `Q-006`;
- `desktop-skill-ui-size-performance`: committed, verified, and already synced;
- `macos-developer-id-signing`, `macos-timestamp-retry`, and
  `react-type-workspace-boundary`: later hosted release runs satisfied their
  remaining CI gates.

The final inventory contains 27 active changes after this audit record is
archived. Each has a concrete implementation, verification, release, or
external gate.

The roadmap was also corrected because it still described the already archived
`database-migration-safety` change as active.

### Remaining queue by lifecycle gate

| Gate                                    | Count | Records                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------- | ----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Implementation                          |    12 | `agent-management-workbench`, `agent-provider-protocol-bridge`, `desktop-image-generation-workbench`, `desktop-prompt-list-projection`, `legacy-upgrade-recovery-audit`, `mcp-version-history-and-projection-safety`, `plugin-management`, `risk-aware-verification-harness`, `rules-managed-copies`, `skills-issue-194-shared-global-target`, `web-agent-service-parity`, `web-sync-contract-completion` |
| Verification or correctness convergence |     5 | `desktop-issue-192-copy-action-parity`, `grok-build-platform-support`, `plugin-issue-190-multi-native-manifests`, `rules-issue-193-missing-project-reconciliation`, `sync-issue-191-safety-report-contract`                                                                                                                                                                                               |
| Release or external gate                |    10 | `cloud-account-store-client`, `desktop-upgrade-snapshot-lock-recovery`, `mobile-prompt-persistence-hardening`, `pi-agent-separation`, `r2-direct-downloads`, `release-0-6-0-version-alignment`, `republish-0-5-9-20260714`, `self-hosted-skill-sync-reliability`, `update-channel-hardening`, `windows-packaged-upgrade-startup-gate`                                                                     |

## CLI And Release Findings

- `cli-agent-management` was correctly committed by `7d0b2043`, but its tasks
  still contained a stale “remain active while uncommitted” exit condition.
- The archived CLI split record claimed resource tests remained below 1,000
  lines. Later changes grew `run.test.ts` to 1,040 and `skill.test.ts` to 1,028;
  both were split back below the default target.
- `prompt-workspace.ts` reached 1,504 lines in the current recovery work and
  failed the enforced 1,500-line gate. Restore-marker ownership was extracted
  to a focused sibling module, reducing the entry file below the gate to 1,491
  lines after formatting in the final implementation batch.
- The still-active `legacy-upgrade-recovery-audit` has four current verification
  failures despite an older implementation paragraph claiming final focused
  checks passed: three Prompt workspace assertions and one Desktop TypeScript
  narrowing error. These are real recovery exit gates, not reasons to keep
  completed unrelated records active.
- Remote GitHub metadata on 2026-08-18 shows `v0.5.9` published with assets but
  incorrectly marked as a prerelease; GitHub Latest stable resolves to
  `v0.5.8`. `v0.6.0-beta.1` remains a withdrawn draft prerelease. Therefore the
  `republish-0-5-9-20260714` and 0.6 publication records remain active.
