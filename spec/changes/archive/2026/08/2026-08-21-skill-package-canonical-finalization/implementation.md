# Implementation

## Root Cause

The real Desktop lifecycle reproduced
`DATABASE_FINALIZE_FAILED: resource bundle contains undeclared directory:
.prompthub`. After the pending canonical bundle was created at
`data/skills/<skill-id>`, the legacy managed-repository resolver mistook that
bundle for the old `<managed-container>` and wrote `.prompthub/` plus `repo/`
inside it. Canonical verification correctly rejected those undeclared entries.

## Implemented Boundary

- Canonical package staging now lives under
  `operations/skill-package-lifecycle` rather than the canonical Skill bundle
  namespace.
- Canonical installs and updates publish directly from the verified staging
  package through `CanonicalSkillDB`; they do not create legacy managed
  containers or legacy recovery manifests.
- Legacy database-authority mode retains its reversible managed-repository
  replacement behavior.
- The canonical adapter rollback test now covers publication failure after a
  SQLite package finalization attempt.

## Verification

- The original production failure was reproduced before the fix by the real
  canonical lifecycle integration test as
  `DATABASE_FINALIZE_FAILED: resource bundle contains undeclared directory:
.prompthub`.
- Desktop focused suites passed: 47 tests across the canonical package and
  legacy lifecycle test files; the wider initial focused batch passed 83 tests
  across four files.
- The changed Desktop lifecycle module reached 100% statements, branches,
  functions, and lines in the focused coverage run.
- The canonical database publication rollback suite passed all four tests.
- Desktop and Core typechecks, targeted ESLint, Prettier, and the 2,000-line
  source/test limit passed.
- `pnpm spec:test` passed after regenerating `spec/changes/index.md`.
- `pnpm verify:changed` passed all 29 checks, including 8 Desktop test shards
  and the affected shared, database, Core, CLI, Web, Worker, and mobile gates.
- `pnpm build` completed successfully for Renderer, Main, and Preload.

## Release State

Commit `494d57d7da654b8380e4b81f8f51fc5c72e6b7f7` was pushed to `main`.
Untagged candidate run `32450618343` passed full verification and all platform
builds, including the Windows x64 two-launch packaged upgrade smoke and signed,
notarized macOS x64/arm64 artifacts.

The annotated `v0.6.0-beta.1` tag was moved with an expected-old-value lease to
tag object `e85f3d1b3af5b67a8fdd7ae526ba04874ad07588`, peeled to the verified commit.
Tagged Desktop run `32452004626` replaced all 20 prerelease assets and tagged
Self-Hosted Web run `32452004602` published beta GHCR digest
`sha256:2ffd84fd8e5b6e4d79ee0107160ba2ec7f1a8ce41441256d7bcdb24131169e17`.
The release remains non-draft and prerelease; representative public asset URLs
returned HTTP 200, while GHCR `latest` retained the stable digest.
