# Spec Delta: Windows Code Signing And Reputation

## Added Requirements

### `FR-WINSIGN-001`: Signed Windows release artifacts

Every published Windows installer and executable shipped inside it MUST have a
valid Authenticode signature whose subject matches the approved PromptHub
publisher and whose certificate chain and trusted timestamp verify after build.
Unsigned, expired-without-timestamp, or mismatched artifacts MUST NOT publish.

### `FR-WINSIGN-002`: Reproducible release verification

The release workflow MUST verify signatures after packaging and again from the
downloaded release candidate. The release record MUST capture artifact hashes,
certificate thumbprint/subject, timestamp evidence, Windows matrix results, and
the fact that reputation prompts can depend on external Microsoft reputation.

### `NFR-WINSIGN-001`: Secret isolation

Private signing material MUST use an approved CI secret/certificate provider,
be scoped to protected release jobs, be redacted from logs, and be destroyed
from the runner workspace after use. Fork and pull-request jobs MUST not receive
signing credentials.

## Verification

- `TEST-WINSIGN-001`: installer and unpacked executable signature verification,
  subject/thumbprint mismatch, altered artifact, missing/invalid timestamp, and
  certificate expiry/revocation behavior.
- `TEST-WINSIGN-002`: protected release trigger, PR/fork secret absence, log and
  artifact scan, cleanup on success/failure/cancellation, and unsigned publish
  prevention.
- `TEST-WINSIGN-003`: clean Windows 10 and Windows 11 installation, launch,
  upgrade, uninstall, SmartScreen/Smart App Control evidence, and rollback.
