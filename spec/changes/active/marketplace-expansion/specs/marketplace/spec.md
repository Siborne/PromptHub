# Spec Delta: Marketplace Expansion

## Added Requirements

### `FR-MARKET-001`: Explicit marketplace source contract

Every marketplace source MUST declare supported asset kinds and capabilities
for catalog, search, pagination, detail, package retrieval, versions, and
verification. Unsupported capabilities MUST be visible and MUST NOT be
silently emulated through HTML scraping.

### `FR-MARKET-002`: Verifiable SkillHub import

PromptHub MAY expose SkillHub after its catalog and package contract is backed
by current public documentation or a versioned official CLI/API. Package bytes,
declared digest, publisher key, and signature MUST be verified before import;
PromptHub safety scanning remains an independent decision.

### `FR-MARKET-003`: Prompt Store import

Prompt Store results MUST use Prompt fields, versions, media, tags, author and
license metadata rather than the Skill package schema. Import creates a local
Prompt identity, records immutable source provenance, and never overwrites an
existing local Prompt without an explicit update decision.

### `NFR-MARKET-001`: Bounded network and cache behavior

Catalog operations MUST be paginated, cancellable, time-bounded, retried only
for transient failures with bounded backoff, and cached with source-specific
TTL and capacity limits. Credentials and raw tokens MUST NOT enter logs.

## Verification

- `TEST-MARKET-001`: capability matrix, unsupported operations, pagination,
  cancellation, timeouts, retry exhaustion, stale cache, and source disable.
- `TEST-MARKET-002`: valid SkillHub package, unknown/revoked key, altered raw
  payload, digest mismatch, signature mismatch, oversized package, unsafe
  archive path, and independent safety-scan outcomes.
- `TEST-MARKET-003`: Prompt search/detail/import/update, duplicate provenance,
  version/media preservation, offline local use, and source removal.
