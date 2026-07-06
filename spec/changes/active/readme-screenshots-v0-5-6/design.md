# Design — Screenshot capture pipeline

## Approach

Reuse the existing Playwright Electron harness in
`apps/desktop/tests/e2e/helpers/electron.ts`. It already supports:

- Custom seed JSON via `PROMPTHUB_E2E_SEED_PATH`
- Per-run `userData` directories
- `setAppLanguage` to force English
- `setAppSettings` to nudge persisted settings via real IPC

We add a new script (not a normal e2e test) that:

1. Builds a rich seed JSON with realistic but fictional data.
2. Launches the app and walks the surfaces of interest.
3. Calls `page.screenshot({ path, omitBackground: false })` after each surface
   stabilizes.

The script lives under `apps/desktop/scripts/capture-screenshots.mts` so it is
TypeScript-sourced (consistent with `check-bundle-budget.mts`) and runs via
`pnpm --filter @prompthub/desktop screenshots`.

## Surface plan

| File | Surface | State preconditions |
| ---- | ------- | ------------------- |
| `1-index.png` | Two-column home | Multiple folders + favorites + tags populated |
| `10-skill-store.png` | Skill Store | Default sources reachable in offline mock state |
| `11-skill-platform-install.png` | Skill platform install | One installed skill, platform sheet open |
| `12-skill-files-version-diff.png` | Skill version diff | Multi-version skill file shown |
| `13-rules-workspace.png` (new) | Rules workspace | Sample rules across cursor / claude / agents |
| `14-skill-projects.png` (new) | Project Skill workspace | One sample project with a few SKILL.md files |
| `15-quick-add-ai.png` (new) | Quick Add modal in AI mode | Modal open with fields populated |
| `16-tag-manager.png` (new) | Tag manager modal | Multiple tags available to merge / rename |
| `17-appearance-motion.png` (new) | Appearance settings, motion section | Settings open on Appearance, focused on Motion |

## Window size

We standardize on **1440 × 900** (logical) so all PNGs share a width and look
consistent on README. Done by `await page.setViewportSize`.

## Seed shape

The existing `applyE2ESeed` in `src/main/testing/e2e.ts` accepts:

- `settings` — Settings KV pairs
- `folders` / `prompts` / `versions` — direct DB inserts
- `skills` — name / description / files structure

For the screenshot seed we want:

- 4 folders: `Engineering`, `Marketing`, `Operations`, `Personal`
- 8 prompts spread across folders, each with realistic tags
- 1 favorite, 1 pinned
- 3 skills with a small directory tree each
- Settings overrides:
  - `theme: "dark"` (the README hero looks better dark)
  - `language: "en"`
  - `homeLayout` containing visible blocks if the store key is renderable

We don't try to seed Rules / Projects through the seed pipeline — we'll create
those at runtime via the renderer's `window.api`. (Rules use the live CLAUDE.md
in repo so we'll point `rules.add-project` at a temp dir we set up before
launch.)

## Script flow

```ts
const { app, page, userDataDir } = await launchPromptHub("screenshots.seed.json");

await page.setViewportSize({ width: 1440, height: 900 });
await setAppLanguage(page, "en");
await setAppSettings(page, { theme: "dark", motionPreference: "standard" });

// 1-index.png
await captureAt(page, "main view", out("1-index.png"));

// 13-rules-workspace.png
await page.getByRole("button", { name: /rules/i }).click();
await captureAt(page, "rules workspace", out("13-rules-workspace.png"));

// ... and so on
```

`captureAt` wraps `page.waitForLoadState("networkidle")` with a small motion
settle delay (300ms) and then calls `page.screenshot`.

## Failure modes

- If a surface has no seed data, screenshot is empty list — script throws so we
  notice immediately rather than silently committing a blank PNG.
- If user is locale-locked to zh because of preserved storage, we force the
  language at start.
- Timestamp drift: we don't compare PNGs in tests, so anti-aliasing or
  date-formatting drift is fine; we just commit them.

## Rollback

If the screenshots regress, drop them and revert the README changes. The seed
and script stay in the repo so we can re-capture later.
