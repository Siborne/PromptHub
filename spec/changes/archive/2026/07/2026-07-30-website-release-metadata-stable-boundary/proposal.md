# Website Published Stable Boundary

## Phase And Status

- Phase: converge
- Status: archived
- Primary requirement: `FR-WEBREL-001`
- Exit condition: website generation ignores build and preparation versions
  until the release index explicitly marks a version as published stable.

## Why

The website release generator previously used the root package version as
public release metadata. A normal version bump could therefore advertise
downloads before their artifacts existed. A first correction used dated
changelog headings, but submission review found that maintainers can date a
changelog during release preparation, so that signal was still too weak.

## Scope

- In scope:
  - select public stable versions from explicit release-index status
  - require a matching dated changelog entry
  - cover preparation, ordering, duplicate, and invalid-state paths
- Out of scope:
  - changing product build versions
  - publishing release artifacts
  - contacting GitHub during deterministic website builds

## Risks

- An unsynchronized release index and changelog must fail the build rather than
  publish ambiguous metadata.

## Rollback Thinking

Reverting restores root-package-driven metadata, but doing so can expose
unpublished download links. The generated public files themselves remain
unchanged until a stable record is promoted.

## Related Records

- Release rules: `spec/releases/release-rules.md`
- Release index: `spec/releases/README.md`
