# Proposal

## Problem

Store installation and update previews currently require the configured AI
safety model to succeed. An expired or invalid model token blocks installation
before PromptHub reaches its mandatory local package preflight, even though the
package lifecycle already supports safe preflight-only operation when no AI
model is configured.

## Scope

- Keep explicit manual AI safety scans AI-required.
- Allow install and update workflows to fall back to the deterministic local
  preflight when AI configuration, authentication, or availability fails.
- Preserve full-package staging, source validation, blocked-pattern checks,
  fingerprint review, and rollback as mandatory gates.
- Never show provider request identifiers or raw authentication errors as the
  installation result.

## Compatibility

No stored schema changes are required. Existing successful AI scans continue to
produce AI reports. Fallback reports are explicitly marked `preflight`.
