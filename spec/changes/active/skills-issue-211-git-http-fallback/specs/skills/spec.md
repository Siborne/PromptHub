# Skills Transport Delta

## Added Requirements

### FR-SKILL-211-001 HTTPS Git transport fallback

When a `remote-git` Skill package uses a validated public HTTPS repository and
Git clone fails, PromptHub MUST attempt one bounded HTTP archive download before
reporting source failure.

#### AC-SKILL-211-001A

Given Git is missing from the Desktop process environment, when a public
GitHub Skill is installed, the operation succeeds from the HTTP archive and
persists the same complete package inventory expected from Git clone.

#### AC-SKILL-211-001B

Given Git clone fails for another recoverable reason, when the HTTP archive is
available, install, update and source snapshot/fingerprint operations continue
through the same validated package path.

### FR-SKILL-211-002 Safety and fidelity parity

HTTP fallback MUST preserve the complete selected Skill directory and MUST NOT
bypass archive budgets, path validation, package validation, selector matching,
fingerprinting, deterministic safety preflight, optional AI review, staging or
rollback.

#### AC-SKILL-211-002A

An archive containing `SKILL.md`, `docs/guide.md`, `scripts/setup.sh` and
`assets/icon.png` produces the same managed inventory after fallback.

#### AC-SKILL-211-002B

Traversal, duplicate, oversized, missing-`SKILL.md`, wrong-selector and
ambiguous packages fail before durable mutation.

### FR-SKILL-211-003 Actionable terminal failure

When Git is unavailable and no HTTP fallback is eligible, PromptHub MUST tell
the user that Git is unavailable and that Git must be installed or added to
`PATH` before restarting PromptHub. When Git and HTTP archive materialization
both fail, PromptHub MUST state that both transports failed and direct the user
to Git/PATH, network/proxy and source-access checks.

#### AC-SKILL-211-003A

The failure contract exposes a bounded reason enum, not raw process errors.

#### AC-SKILL-211-003B

User-facing copy is localized in all supported Desktop locales and does not
contain credentials, query secrets, stack traces or local paths.

### FR-SKILL-211-004 Bounded eligibility

HTTP fallback MUST be limited to validated HTTPS repository URLs and MUST pass
the existing remote-fetch source-scope and DNS/SSRF policy. SSH and plain HTTP
sources remain Git-backed; private-network HTTP fallback is not enabled.

#### AC-SKILL-211-004A

SSH plus missing Git performs no HTTP request and returns the actionable
missing-Git reason. A blocked private host produces no outbound archive request.

#### AC-SKILL-211-004B

The archive URL contains no userinfo, query or fragment and branch/ref values
are encoded as URL path data.

## Modified Requirement

The stable `remote-git` adapter contract changes from Git-clone-only to
Git-first plus bounded public-HTTPS archive fallback. Package semantics and
source identity do not change.

## Non-requirements

- HTTP fallback does not preserve Git history.
- PromptHub does not silently convert SSH/private authentication to anonymous
  HTTPS.
- Git push, backup and Plugin installation are not changed here.
