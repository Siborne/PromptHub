# Design

## Existing Boundary

The current implementation contains two different safety boundaries:

- Explicit detail-page scans are AI-only.
- `assertStagedRemoteSkillPackageSafe` already treats AI as optional and always
  runs `scanSkillSafetyPreflight` against the complete staged package.

Installation preview currently calls the AI-only API unconditionally, creating
a stricter but less reliable gate than the final package lifecycle.

## `DES-SISR-001`: Explicit fallback intent

Add `fallbackToPreflight` to `SkillSafetyScanInput`. Only installation and
update-preview callers set it. Manual scan callers omit it.

The main process always completes source and content preflight first. If AI is
missing or fails and fallback was requested, it returns the same structured
report with `scanMethod: preflight`. Otherwise it preserves the existing error.

## `DES-SISR-002`: Final package enforcement

`assertStagedRemoteSkillPackageSafe` logs AI failure with its stack and continues
using the already completed full-package preflight. A blocked preflight still
throws; a high-risk preflight still requires fingerprint-pinned review.

## Traceability

| Requirement | Design | Verification | Task |
| --- | --- | --- | --- |
| `FR-SISR-001` | `DES-SISR-001`, `DES-SISR-002` | `TEST-SISR-001`, `TEST-SISR-002` | `T-SISR-001`, `T-SISR-002` |
| `FR-SISR-002` | `DES-SISR-001` | `TEST-SISR-003` | `T-SISR-001` |
