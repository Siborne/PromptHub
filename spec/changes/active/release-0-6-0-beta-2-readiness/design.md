# PromptHub 0.6.0-beta.2 Readiness Design

<!-- traceability: enforced -->

## `DES-BETA2-001`: One Candidate Version

Update the existing seven shipped version sources, `CLI_VERSION`, its direct
test, and the repository version-alignment expectation. Private shared packages
keep their independent `0.1.0` versions.

## `DES-BETA2-002`: Stable Metadata Remains Independent

Add a dated beta.2 changelog section and localized preview summaries. Run the
existing website sync command, whose stable-record selector continues to derive
public download metadata from `0.5.9`. The work is linear in the bounded set
of manifests and documentation files and adds no runtime I/O or network cost.

## `DES-BETA2-003`: Preparation Is Not Publication

Local preparation may run deterministic source, test, build, and smoke gates.
It does not create a tag, upload artifacts, mutate GHCR aliases, or claim
platform signing. The full release profile and tag-triggered platform jobs are
separate blocking evidence.

## Affected Areas

- Data, schema, IPC, sync payloads, and runtime storage: unchanged.
- Build identity: Root, Desktop, CLI, Web, Worker, and Mobile.
- Public documentation: changelog, release records, localized README preview
  sections, and generated website changelog.
- Screenshots: unchanged because this batch changes release metadata, not the
  captured UI assets.

## Failure And Rollback

- Any failed local gate leaves the candidate untagged and unpublished.
- Revert the bounded version/documentation batch to return to beta.1 metadata.
- Stable `0.5.9` downloads and GHCR aliases are never mutated by preparation.

## Analyze Result

- The user selected a new beta.2 identity, resolving the earlier beta.1
  same-version replacement exception.
- The current remote has no `v0.6.0-beta.2` tag or GitHub Release.
- The implementation, verification, and task chain is complete with no
  unresolved product or data decision.
