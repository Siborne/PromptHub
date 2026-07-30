# Skill Install Safety Resilience Delta

## `FR-SISR-001`: AI failure must not bypass or block deterministic package safety

Store installation and update workflows must continue with the deterministic
preflight when the optional AI assessment is unavailable. They must not skip
source restrictions, package validation, local content checks, fingerprint
review, or rollback.

### Scenario: Configured AI token is invalid

- Given the selected AI model rejects its token
- When the user previews or installs a Store Skill
- Then PromptHub returns a `preflight` safety report instead of a raw provider error
- And the final staged package is still scanned locally before any durable write
- And blocked or high-risk local findings retain their normal block/review behavior

## `FR-SISR-002`: Manual AI scan semantics remain explicit

The detail-page manual AI scan must continue reporting configuration or provider
failure instead of silently presenting a local preflight as an AI result.
