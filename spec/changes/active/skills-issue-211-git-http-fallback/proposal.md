# Skills Issue 211 Git HTTP Fallback

Status: review-pending — real Windows packaged UI acceptance remains

## Problem

GitHub issue #211 reports that Windows users can scan HTTPS Git repositories
and browse built-in Skill stores, but every install fails with the generic
message that the Skill source is unavailable. The reporter confirmed that
installing Git resolves the failure.

Public GitHub scanning uses HTTP APIs, while install, update and source-check
materialization switch to the ambient `git` executable. PromptHub does not
bundle Git, does not preflight its availability, and currently collapses a
missing executable and every other remote staging failure into
`SOURCE_UNAVAILABLE`.

## User Outcome

- HTTPS Git-backed Skill packages remain installable when Git is missing or
  clone fails, provided a bounded HTTP archive fallback succeeds.
- The fallback preserves the complete package and passes through the existing
  archive, package, safety, fingerprint, staging and rollback gates.
- When no transport succeeds, PromptHub explains whether Git is unavailable
  and that the HTTP archive fallback also failed, without leaking source
  credentials or local paths.

## Scope

- Desktop Skill install, update and source snapshot/fingerprint paths backed by
  `remote-git`.
- Public HTTPS GitHub and Git-forge-compatible archive URLs derived from an
  already validated repository URL.
- Structured failure reasons and localized renderer copy.
- Custom Skill store branch discovery error copy when Git is unavailable.
- Regression coverage and stable Skill transport documentation.
- Static audit of related Git-dependent surfaces.

## Non-goals

- Bundling or installing Git.
- Replacing Git for SSH sources, authenticated private repositories, Git push,
  backup transports or history-preserving operations.
- Treating a downloaded archive as a repository with commit history.
- Changing Skill package identity, persistence, fingerprint or trust policy.
- Refactoring Plugin package materialization in this change.

## Source Of Truth And Ownership

- The remote repository remains the content source of truth.
- The validated materialized Skill directory remains the input to package
  fingerprinting and managed publication.
- `apps/desktop/src/main/services/skill-installer-remote-package.ts` owns the
  Desktop remote package transport orchestration.
- `packages/shared/types/skill.ts` owns the additive structured failure reason.
- Renderer i18n owns user-visible recovery guidance.

## Risk And Capacity

- Git is attempted once. A public HTTPS fallback performs at most one bounded
  archive request through the existing proxy, DNS/SSRF, redirect, timeout and
  byte limits.
- Archive extraction reuses the existing entry-count, depth, file-size,
  aggregate-size, duplicate-path and traversal protections.
- The package is validated and scanned after either transport; HTTP success
  cannot bypass package safety review.
- Staging remains temporary and is cleaned after success or failure. Durable DB
  or managed-repo mutation does not begin until materialization succeeds.

## Related Issue Audit

- Git-backed Skill install, update, fingerprint and snapshot share the affected
  adapter and are in scope.
- Custom Skill store branch discovery also depends on Git; this change adds an
  actionable missing-Git message but branch discovery has no archive-equivalent
  operation.
- Plugin HTTPS Git import has a clear Git failure message but no HTTP archive
  fallback. It remains a separate package-domain follow-up because Plugin
  manifests, inventories and activation semantics differ from Skills.
- CLI Skill Git installation and Git backup/push transports remain explicit Git
  operations; they require separate product decisions and are not silently
  changed by a Desktop installer bugfix.
- GitHub issues #80, #128, #141 and #185 concern different source/catalog/sync
  boundaries. They are not duplicates of #211.

## Rollback

Removing the HTTP fallback returns the adapter to Git-only materialization. No
schema, durable record or migration must be rolled back.
