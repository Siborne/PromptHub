# Windows Code Signing And Reputation Proposal

## Phase And Status

- Phase: analyze
- Status: design-ready
- Primary requirements: `FR-WINSIGN-001`, `FR-WINSIGN-002`
- Related issue: #92
- Exit condition: published Windows installers and executable payloads carry a
  verifiable PromptHub Authenticode signature and pass the release matrix.

## Why

The release workflow builds Windows artifacts but the current documented
verification concentrates on macOS. An unsigned or incorrectly timestamped
Windows executable can be blocked or strongly warned by Windows 11 security
controls. User instructions to bypass protection are not a product fix.

## Scope

- Authenticode signing for installer and shipped executable payloads.
- Secure CI certificate/key access, timestamping, and post-build verification.
- Windows 10/11 clean-machine release evidence and rollback procedures.
- Buying a certificate and guaranteeing immediate SmartScreen reputation are
  operational dependencies, not claims made by repository code.

## Risks And Rollback

- Signing credentials are high-value secrets; access is release-environment
  scoped, auditable, and never available to pull-request builds.
- Certificate expiry/revocation or timestamp failure blocks publication rather
  than emitting unsigned artifacts.
- Rollback republishes a previously verified signed release; it never disables
  OS security controls.

## Related Records

- `.github/workflows/release.yml`
- `spec/knowledge/behavior/desktop.md`
