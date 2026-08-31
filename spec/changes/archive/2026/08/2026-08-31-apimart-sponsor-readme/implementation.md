# APIMart README Implementation

## Status

Completed README content and asset synchronization on 2026-08-31.

## Initial Delivery (`dee61e74`)

- APIMart is the first partner in all seven README languages.
- Chinese READMEs share the Chinese banner; the other five share the English
  banner. Both images preserve the supplied PNG bytes.
- All fourteen campaign links use `https://go.apimart.ai/gh-prompthub`.
- Infistar, other README content, website pages, application code, and release
  metadata remain unchanged.

## Initial Delivery Verification

- Session Node/remark/GFM assertions: passed for all seven documents; verified
  table shape, order, links, relative images, and unchanged surrounding content.
- Supplied PNG byte comparisons: passed for both images.
- `pnpm --dir apps/desktop exec prettier --check ../../README.md ../../docs/README.en.md ../../docs/README.zh-TW.md ../../docs/README.ja.md ../../docs/README.de.md ../../docs/README.es.md ../../docs/README.fr.md`: passed.
- Scoped `git diff --check`: passed for the seven README files.
- `node scripts/validate-change-traceability.mjs spec/changes/active/apimart-sponsor-readme`:
  passed before archival.
- `node scripts/generate-spec-change-index.mjs --check`: passed for the full
  worktree and the isolated inventory built from staged change records.
- Staged file allowlist: exactly seven READMEs, two banner assets, five change
  documents, and the generated inventory. The unrelated inventory delta is
  identical to its pre-submission state.

These content checks were completed before submission preparation. The README
content and assets did not change afterward. Submission also checks this record's
formatting, traceability, generated inventory, and staged file scope.

## Limits and Convergence

No application tests, website build, browser visual check, or provider pricing
and performance validation were run. The supplied commercial claims are not
independent product acceptance results. No persistent runtime resources were
created. Public README files are the source of truth for this static campaign;
no stable application knowledge or release records need changes.

The change is archived after document validation. The existing dirty inventory
is preserved in the worktree; only the inventory generated from the submission's
staged change records belongs in this commit.

## Detailed Poster Revision (2026-08-31)

The maintainer's GitHub screenshot showed the simplified creative already
occupying a large area. The selected Chinese and English detailed posters now
replace those images at the same paths, so every README language picks up the
new creative without changing its prose, table order, or registration links.

The posters retain their original 3840 × 2160 PNG bytes. Chinese remains shared
by Simplified and Traditional Chinese; English remains shared by the other five
languages. The embedded website text is part of the supplied creative; clicking
either poster still uses the dedicated PromptHub registration URL.

Revision verification: PNG byte equality and 3840 × 2160 dimensions passed for
both assets. All seven README files match `dee61e74` exactly, with the expected
language image and two registration links per campaign. The targeted traceability
command passed before re-archival; the generated inventory check passed afterward
without any inventory edit. The earlier application, website, browser, and
provider acceptance limits remain unchanged.

Rollback: restore the two image files from commit `dee61e74`; no data migration
or README changes are required.
