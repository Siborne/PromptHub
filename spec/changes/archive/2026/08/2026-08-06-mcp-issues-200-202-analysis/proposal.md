# MCP Issues 200-202 Analysis Proposal

## Status

- Date: 2026-08-06
- Owner surface: MCP management and Agent platform compatibility
- Change type: issue triage, specification, and documentation sync
- Product code scope: none

## Why

Issues #200, #201, and #202 expose three different MCP boundaries that should
not be collapsed into one implementation:

1. Project MCP distribution is partly implemented, but the My MCP library
   detail and batch surfaces still describe global Agent targets only.
2. Pi's MCP support is currently extension-owned. The third-party
   `pi-mcp-adapter` package is not the same thing as a native Pi MCP contract.
3. PromptHub's first MCP version stores environment values and headers as
   local server configuration. Supporting agent-specific reference syntax and
   hiding secret-bearing values requires a compatibility and migration design,
   not only a parser change.

The repository also had an outdated GitHub open-issue snapshot, so the current
remote list and local delivery overlay need to be brought back into alignment.

## Scope

- Record the current remote state and links for #200, #201, and #202.
- Map each issue to the current implementation and stable MCP/Pi boundaries.
- Document the security, compatibility, migration, and rollback gates for a
  future implementation.
- Update the local GitHub delivery overlay and the stable Agent platform
  reference.
- Refresh the repository-level open-issue snapshot from GitHub.
- Keep follow-up product implementation in separate issue-specific changes.

## Non-goals

- Do not add a Pi MCP target or install a third-party Pi extension.
- Do not change MCP env/header storage, redaction, export, backup, or migration
  behavior in this documentation change.
- Do not silently close, relabel, or change the public state of GitHub issues.
- Do not treat Oh My Pi support as proof of native Pi support.
- Do not create a runtime MCP gateway, proxy, or process manager.

## Impacted records

- GitHub issues: #175, #187, #200, #201, #202
- Existing active change: `pi-agent-separation`
- Existing active change: `agent-management-workbench`
- Stable reference: `spec/knowledge/reference/agent-platforms.md`
- Issue overlay: `spec/issues/active/local-github-status.md`
- Remote snapshot: `spec/issues/active/github-open.md`

## Risks and rollback

- Upstream Pi and Oh My Pi configuration contracts may change. Record source
  URLs and evidence dates, and revalidate before implementation.
- The current MCP v1 plaintext local-storage decision is historical behavior.
  A future secret-handling change must include import, export, backup, sync,
  preview, and migration coverage.
- The refreshed issue snapshot is a point-in-time remote record. It does not
  replace the local delivery overlay or domain specifications.
- Rollback is documentation-only: restore the prior records and snapshot. No
  user data, target configuration, or runtime process is changed.

## Exit criteria

- The five change artifacts contain a complete `FR -> DES -> TEST -> T`
  mapping.
- Current MCP behavior and unresolved issue boundaries are recorded without
  claiming unimplemented product behavior.
- The local overlay records #200, #201, and #202 as open and triaged.
- The open GitHub snapshot reflects the 2026-08-06 remote list.
- Stable Agent platform knowledge distinguishes Pi from Oh My Pi and records
  the current secret-value boundary.
- Documentation checks pass and this documentation change is archived.
