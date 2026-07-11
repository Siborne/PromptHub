# Skill Source Update Trust Review

## Why

A 2026-07-11 user report showed two failures in the installed Skill update flow: an unchanged self-hosted Gitea Skill was reported as updateable, and applying the reported update failed with `SAFETY_SCAN_BLOCKED_UPDATE` even though the source and Skill were owned by the user. The current flow offers neither finding review nor an explicit trust decision.

## Scope

- Make legacy-to-v1 package fingerprint reconciliation algorithm-aware so unchanged Skills do not produce false updates.
- Replace the remaining line-based frontmatter hash normalizer with the shared YAML contract.
- Distinguish non-overridable `blocked` findings from reviewable `high-risk` findings.
- Return structured update review data across main/preload/renderer boundaries.
- Allow one-time approval pinned to the exact staged package fingerprint.
- Allow an explicit persistent trust decision scoped to one Skill source identity (`repo + branch + directory/source_id`).
- Keep path traversal, invalid package structure, SSRF/internal-source hard blocks, and `blocked` safety findings non-overridable.
- Bound source-address verification so an unreachable custom host cannot freeze an already staged local package update.

## Non-Goals

- Trust an entire Git/Gitea host.
- Skip staging, fingerprinting, validation, rollback, or safety scanning.
- Automatically trust a source because it is private or self-hosted.
- Change linked-local overwrite policy.

## Design Conflict Resolution

The previous v1 specification treated both `high-risk` and `blocked` as hard failures. The user requested a planned implementation that supports explicit Skill/source trust. This change narrows the hard boundary: `blocked` remains prohibited, while `high-risk` becomes a structured manual-review state with fingerprint-pinned approval.

## Rollback

Remove the review result and trust settings, restore hard blocking for `high-risk`, and retain the algorithm-aware fingerprint and YAML hash fixes. No database schema migration is required.
