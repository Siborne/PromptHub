# Design

## Classification

- Defect taxonomy: `SDT-002` lifecycle failure-path incompleteness and
  `SDT-005` source/transport error misclassification.
- Owning surface: Desktop main-process Skill package adapter.
- Durable source of truth: unchanged remote repository plus the validated
  materialized package selected from it.

## Current Call Chain

```text
renderer install/update/check
  -> Skill package operation or snapshot IPC
  -> remote-git adapter
  -> ambient `git clone`
  -> package selection/validation/safety/fingerprint
  -> staging/replacement/DB finalization
```

Public GitHub scan is separate and uses GitHub HTTP APIs, so successful scan
does not prove that the ambient Git executable exists.

## DES-SKILL-211-001 Git-first materializer

Introduce one Desktop-main helper used by install, fingerprint and snapshot.
It performs:

1. one validated shallow Git clone;
2. on clone failure, derive one archive URL only for HTTPS repositories;
3. fetch bytes through the existing bounded remote fetcher;
4. extract through the existing safe ZIP extractor;
5. require one archive checkout root and return that root to the unchanged
   selector/package pipeline.

The helper removes transport branching from downstream package logic, so Git
and HTTP cannot diverge in selector, validation, safety or fingerprint rules.

## DES-SKILL-211-002 Archive URL policy

- Strip URL userinfo, query and fragment before derivation.
- GitHub uses its repository archive endpoint.
- GitLab.com uses its documented archive route.
- Other HTTPS forges use the Gitea-compatible `/archive/<ref>.zip`
  route; a failure is terminal and does not fan out to guessed endpoints.
- Use the explicit branch when present and `HEAD` otherwise.
- SSH and HTTP do not enter fallback. HTTPS archive fetches still pass the
  existing source-scope, DNS/SSRF, proxy and private-address policy, so a
  blocked address produces no outbound request.

This keeps network work O(1): one clone attempt and at most one archive request.
Archive processing is O(total uncompressed package bytes + entries) with the
existing bounded memory and entry limits.

## DES-SKILL-211-003 Structured failure reason

Add optional failure reasons:

- `git-unavailable`
- `git-http-fallback-failed`

The lifecycle status and stable failure code remain `source-unavailable` /
`SOURCE_UNAVAILABLE`. Main preserves only the bounded reason plus a sanitized
diagnostic summary. Renderer selects localized recovery copy from the reason
and never renders raw process output for these known failures.

## DES-SKILL-211-004 Branch discovery

The existing branch suggestion IPC still requires Git because listing refs is
not equivalent to downloading a package archive. Its spawn error will use the
same bounded Git-unavailable error type, and both custom-source forms will map
that condition to localized guidance while retaining manual branch entry.

## Failure Matrix

| Git | HTTP eligibility/result | Outcome |
| --- | --- | --- |
| succeeds | not attempted | continue package pipeline |
| missing/fails | eligible + succeeds | continue package pipeline |
| missing/fails | eligible + fetch fails | `git-http-fallback-failed` |
| missing | ineligible | `git-unavailable` |
| fails for another reason | ineligible | existing sanitized source failure |
| succeeds, package invalid | not attempted | existing `INVALID_PACKAGE` |
| HTTP downloads unsafe/invalid archive | extraction/package error | existing `INVALID_PACKAGE` |

## Compatibility And Rollback

No IPC request, DB schema, source identity or filesystem layout changes.
`SkillPackageOperationFailure.reason` is additive. Older renderer behavior
continues to fall back to generic source-unavailable copy if the field is not
understood.

## Analyze Gate

- `FR-SKILL-211-001 -> DES-SKILL-211-001 -> TEST-SKILL-211-001 -> T-SKILL-211-001`
- `FR-SKILL-211-002 -> DES-SKILL-211-001/002 -> TEST-SKILL-211-002 -> T-SKILL-211-002`
- `FR-SKILL-211-003 -> DES-SKILL-211-003/004 -> TEST-SKILL-211-003 -> T-SKILL-211-003`
- `FR-SKILL-211-004 -> DES-SKILL-211-002 -> TEST-SKILL-211-004 -> T-SKILL-211-004`

No blocking conflict remains: the user explicitly requested the transport
fallback, while existing package, security, identity and persistence contracts
remain authoritative.
