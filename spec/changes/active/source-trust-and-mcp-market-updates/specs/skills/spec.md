# Skill Trusted Source Display Delta

## FR-TRUST-001: Readable Trusted Source Entries

PromptHub MUST render trusted Skill update sources as user-recognizable entries rather than raw opaque source keys.

### Scenario: Match a trusted source to installed Skills

- **GIVEN** a trusted source key matches one or more installed Skills
- **WHEN** the user opens Skill safety settings
- **THEN** PromptHub shows the sanitized source label/location and matching Skill names
- **AND** revoking the entry still uses the exact stored source key
- **AND** URL credentials, query secrets, and fragments are not displayed

### Scenario: Preserve a legacy unmatched source

- **GIVEN** a trusted source key no longer matches an installed Skill
- **WHEN** the settings page renders
- **THEN** PromptHub labels it as a legacy/unmatched source and shows only a shortened identifier
- **AND** the user can still revoke it

## Acceptance Mapping

- `FR-TRUST-001 -> DES-TRUST-001 -> TEST-TRUST-001 -> T-TRUST-001`
