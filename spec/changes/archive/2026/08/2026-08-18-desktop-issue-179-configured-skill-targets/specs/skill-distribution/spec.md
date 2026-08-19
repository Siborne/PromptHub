# Delta Spec

## Added

- FR-179-001: Skill distribution target lists MUST include enabled custom Agent platforms even when their root directory has not been detected on disk.
- FR-179-002: Skill distribution target lists MUST include built-in Agent platforms with explicit user configuration overrides even when the overridden root directory has not been detected on disk.
- FR-179-003: Disabled platform settings MUST continue to hide both detected and explicitly configured platforms.

## Modified

- FR-179-004: Platform detection remains a signal for default built-in platform visibility, but it MUST NOT be the only gate for user-configured Agent targets.
- FR-179-005: Shared renderer surfaces that present Skill distribution or Agent target counts MUST use the same deployable platform visibility policy.

## Removed

- None.

## Scenarios

- TEST-179-001: Given an enabled custom Agent in settings and no detected platform IDs, when opening batch Skill distribution, then the custom Agent appears as a selectable target.
- TEST-179-002: Given a built-in Agent with a user root override and no detected platform IDs, when opening batch Skill distribution, then that built-in Agent appears as a selectable target.
- TEST-179-003: Given a custom or configured Agent is disabled, when building visible targets, then it is hidden.
- TEST-179-004: Given an unconfigured built-in Agent is not detected, when building visible targets, then it remains hidden.
