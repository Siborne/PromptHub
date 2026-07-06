# Refresh README screenshots for v0.5.6

## Why

The README screenshots in `docs/imgs/` are 2026-02 / 2026-03 vintage. They predate
the v0.5.6 surfaces we now ship and call out in the README:

- Rules workspace (whole new page introduced in 0.5.6)
- Project Skill workspace (whole new page introduced in 0.5.6)
- Quick Add AI generation entry (changed in 0.5.6)
- Tag manager modal (introduced in 0.5.6)
- Two-column home layout (stabilized in 0.5.6)
- Settings → Appearance with the new motion preference tier

After the README rewrite landed in `9d17d2e`, the screenshots section explicitly
acknowledges they are stale. We want to retire that disclaimer with real
screenshots that match the shipped product.

## Scope

In scope:

- A repeatable Playwright script that boots PromptHub against a rich seed and
  captures PNGs for the documented surfaces above plus refreshed versions of:
  - Main two-column home (`docs/imgs/1-index.png`)
  - Skill store (`docs/imgs/10-skill-store.png`)
  - Skill platform install (`docs/imgs/11-skill-platform-install.png`)
  - Skill file edit + version diff (`docs/imgs/12-skill-files-version-diff.png`)
- A demo seed fixture (`docs/screenshots.seed.json` lives under e2e fixtures)
  rich enough to fill the home layout, gallery, kanban, and Skills surfaces
  without revealing PII.
- README updates that drop the "screenshots are still being refreshed"
  disclaimer once new images are committed.

Out of scope:

- Translating the new screenshot strings — surface labels are language-bound; we
  ship a single locale (English) for now and let translators reuse them. The
  README screenshots section is locale-agnostic outside captions.
- Animated GIFs / videos.
- Marketing site assets (`website/` is not touched).

## Risks & rollback

- Playwright Electron launches require a built `out/main`, so the script depends
  on `pnpm build` succeeding first. If the build is broken, screenshots cannot
  be refreshed and we fall back to the current "still being refreshed" note.
- Screenshots are committed binaries; if a future PR regresses the surfaces, the
  images go stale again. We mitigate by keeping the script and seed under
  version control so rerunning is one command.
- No production / sync impact; entirely a docs change.
