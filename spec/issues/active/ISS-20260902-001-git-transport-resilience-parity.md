# ISS-20260902-001 Git Transport Resilience Parity

Status: open

## Context

The Skill issue #211 audit found other PromptHub surfaces that invoke an
ambient Git executable. The Skill Desktop package adapter now owns a bounded
HTTPS archive fallback and actionable error reasons, but this behavior cannot
be copied into other domains without checking their package contracts.

Related change:
`spec/changes/active/skills-issue-211-git-http-fallback/`.

## Findings

### Plugin HTTPS Git import

`packages/core/src/plugin-library/package-materialization.ts` clones HTTPS and
SSH Plugin sources through the ambient Git executable. Renderer error handling
already distinguishes Git failure and tells the user to check Git, so the
immediate misleading-copy defect does not apply. Public HTTPS Plugin packages
still have no archive fallback.

Before implementing parity, a Plugin change must preserve manifest discovery,
multi-asset inventory, package path selection, semantic classification,
activation, rollback and source identity. It should reuse a core-owned bounded
archive transport rather than import Desktop Skill code.

### CLI Skill Git install

The standalone CLI Git source path also requires the ambient Git executable.
CLI users may reasonably be expected to have Git, but the prerequisite and
missing-command error contract are not currently governed by the Desktop
fallback. A future CLI decision should either document/check the prerequisite
or adopt an app-independent archive fallback with equivalent package tests.

### Explicit Git operations

Git backup, push, branch/ref management and SSH-authenticated private sources
cannot be replaced by a source archive because they require repository history,
credentials or write capability. These operations need precise Git
availability diagnostics, not archive fallback.

## Exit Criteria

- Decide separately for Plugin and CLI whether public HTTPS sources require
  archive fallback or an explicit Git prerequisite.
- If fallback is selected, define the package-domain safety, source identity,
  capacity and rollback contract before implementation.
- Keep history/write/SSH operations Git-only and verify actionable missing-Git
  diagnostics.
