# Marketplace Expansion Design

<!-- traceability: enforced -->

## `DES-MARKET-001`: Source Adapter Boundary

Define marketplace contracts in `packages/shared` and orchestration in
`packages/core`. Each adapter reports `assetKinds`, stable source identity,
capabilities, cursor-based pagination, provenance, and verification evidence.
Desktop and Web clients consume the same normalized result and never call a
source directly from a React component.

Catalog caches are keyed by source, query, locale, and cursor, with bounded
entry count and TTL. One page costs `O(pageSize)` time and memory. Network calls
use explicit connect/response timeouts, a small retry budget for idempotent
reads, exponential backoff with jitter, and cancellation propagation.

## `DES-MARKET-002`: SkillHub Evidence And Verification

The SkillHub adapter remains disabled until current official evidence covers
catalog identity and package retrieval. Document the evidence version and
review date in the adapter fixture. Do not parse marketplace HTML.

For signed packages, preserve the exact raw bytes used by the documented
signature protocol. Use Node `crypto` Ed25519 verification and the official
public-key endpoint; do not implement cryptography. Verify source identity,
declared content digest, signature, archive limits, paths, and manifest before
calling the existing Skill import and safety services. Integrity success never
auto-approves safety findings.

## `DES-MARKET-003`: Prompt Store Boundary

Add a Prompt-specific catalog DTO and import mapper. An imported Prompt receives
a new local UUID plus source ID, source asset ID, source version, author,
license, and fetched-at metadata. Updates compare source versions and present a
diff; they create a normal local Prompt version before applying accepted data.
Local edits do not mutate remote source identity.

Initial delivery is read/search/detail/import only. Publishing requires a
separate authentication, moderation, licensing, and rollback design and is not
hidden inside this adapter.

## Failure And Rollback

- A failing source is isolated; local assets and other sources stay available.
- Partial packages remain in task-owned temporary directories and are removed
  on cancellation or failure.
- No durable Prompt/Skill row is created until verification and import staging
  complete; existing import transactions remain the final commit boundary.

## Analyze Result

- #132 and #177 share source infrastructure but retain separate asset schemas.
- SkillHub currently documents public signature/key endpoints; catalog and
  package retrieval still require exact current protocol evidence before code.

## Traceability

| Requirement      | Design                             | Verification                         | Task           |
| ---------------- | ---------------------------------- | ------------------------------------ | -------------- |
| `FR-MARKET-001`  | `DES-MARKET-001`                   | `TEST-MARKET-001`                    | `T-MARKET-002` |
| `FR-MARKET-002`  | `DES-MARKET-002`                   | `TEST-MARKET-002`                    | `T-MARKET-003` |
| `FR-MARKET-003`  | `DES-MARKET-003`                   | `TEST-MARKET-003`                    | `T-MARKET-004` |
| `NFR-MARKET-001` | `DES-MARKET-001`..`DES-MARKET-003` | `TEST-MARKET-001`..`TEST-MARKET-003` | `T-MARKET-005` |
