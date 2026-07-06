# Implementation log

## Shipped

- Added a rich seed at `apps/desktop/tests/e2e/fixtures/screenshots.seed.json`
  (4 folders, 8 prompts spread across them with realistic tags / favorites /
  pin / version counts, 3 skills with sidecar files).
- Added a new script at `apps/desktop/scripts/capture-screenshots.mts` that
  boots PromptHub via Playwright Electron, applies the seed, fixes language to
  English and theme to dark, then walks each surface and writes a 1440×900
  PNG into `docs/imgs/`.
- Wired `pnpm --filter @prompthub/desktop screenshots` into the desktop
  package.json.
- Captured fresh PNGs for:
  - `1-index.png` (two-column home, freshly populated)
  - `10-skill-store.png` (skill store, real seed entries)
  - `11-skill-platform-install.png` (skill detail in My Skills with platform
    panel area visible)
  - `13-rules-workspace.png` (NEW for v0.5.6)
  - `14-skill-projects.png` (project skill workspace empty state — the page
    surface itself, with "Add Project" CTA)
  - `15-quick-add-ai.png` (Quick Add multi-entry menu visible after pressing
    Alt+Shift+N)
  - `17-appearance-motion.png` (Settings → Appearance, motion-tier section)

## Removed

- `docs/imgs/12-skill-files-version-diff.png` was producing the same byte
  output as `11-skill-platform-install.png` because the seeded skill has only
  a single version, so the "Version History" entry never opened a diff. The
  screenshot was deleted; README references were also removed.
- `docs/imgs/16-tag-manager.png` was producing the same byte output as
  `15-quick-add-ai.png`; the tag-manager entry sits behind a hover state on
  the sidebar that the script could not reliably reach. Deleted from disk and
  README references removed.

## README sync

- `README.md`, `docs/README.en.md`, `docs/README.zh-TW.md`, `docs/README.ja.md`,
  `docs/README.fr.md`, `docs/README.de.md`, `docs/README.es.md` were updated
  to reference exactly the 7 captured surfaces and to drop the previous
  "screenshots are still being refreshed" disclaimer.

## Verification

- `pnpm --filter @prompthub/desktop screenshots` exits 0 from a clean
  `out/main` build with all 9 generated entries (only the 7 we kept are
  unique; 12/16 are duplicates of 11/15 and were intentionally removed).
- All resulting PNGs are 1440×900 RGB, between ~60 KB and ~190 KB.
- `pnpm --filter @prompthub/desktop lint` continues to pass.

## Known caveats

- The Skill version-diff and Tag-manager surfaces require manual capture —
  the seeded data does not produce a multi-version skill diff, and the tag
  manager hovers behind a sidebar gear button that Playwright cannot click
  through the dialog backdrop reliably. Future passes should either add
  direct invocation hooks (e.g. `window.__phub_e2e.openTagManager()`) or
  capture them by hand once per release.
- The seed forces dark theme and English. Other locales would require a
  separate invocation (e.g. `--lang fr`) — out of scope for this iteration.
- The `out/screenshots-userdata` directory is wiped at script start so the
  next run lands on an empty profile and the seed always applies.

## Follow-up

- Add a tiny renderer-side `window.__phub_e2e` debug helper that can open
  modals like the tag manager / version history directly. Then re-enable
  capturing those surfaces in the script.
- Once the helper exists, generalize the script to take a `--locale` flag and
  produce per-locale README image sets if we decide to localize them later.
